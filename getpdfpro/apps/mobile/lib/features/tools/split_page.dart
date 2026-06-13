import 'dart:io';

import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:path_provider/path_provider.dart';

import '../../core/api_client.dart';
import 'widgets/file_picker_field.dart';

/// Split PDF tool page.
///
/// Calls `POST /api/v1/pdf/split-download` with one of two modes:
///
///   - `mode=all` — the server emits one single-page PDF per page of
///     the input. Output is a ZIP, named `<stem>-pages.zip`. The
///     most common use case.
///
///   - `mode=ranges` — the user supplies a ranges spec like
///     `1-3,5,7-9` and the server emits one PDF per range. Use
///     this when you want to extract specific sections without
///     producing dozens of single-page files.
///
/// We mirror the server's `mode` form field exactly so the API
/// documentation is the source of truth.
class SplitPage extends StatefulWidget {
  const SplitPage({super.key});

  @override
  State<SplitPage> createState() => _SplitPageState();
}

class _SplitPageState extends State<SplitPage> {
  PlatformFile? _source;
  String _mode = 'all';
  final _rangesController = TextEditingController();
  bool _busy = false;
  String? _resultPath;
  String? _error;
  int? _parts;
  int? _sourcePages;
  int? _bytes;

  @override
  void dispose() {
    _rangesController.dispose();
    super.dispose();
  }

  Future<void> _pickFile() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf'],
        withData: false,
        allowMultiple: false,
      );
      if (result == null || result.files.isEmpty) return;
      setState(() {
        _source = result.files.first;
        _error = null;
        _resultPath = null;
        _parts = null;
        _bytes = null;
      });
    } catch (e) {
      setState(() => _error = 'Could not open file picker: $e');
    }
  }

  String? _sourcePath() => _source?.path;

  Future<void> _doSplit() async {
    final path = _sourcePath();
    if (path == null) {
      setState(() => _error = 'Pick a PDF first');
      return;
    }
    final file = File(path);
    if (!await file.exists()) {
      setState(() => _error = 'File not found: $path');
      return;
    }
    if (_mode == 'ranges') {
      final ranges = _rangesController.text.trim();
      if (ranges.isEmpty) {
        setState(() => _error = 'split.ranges_required'.tr());
        return;
      }
    }
    setState(() {
      _busy = true;
      _error = null;
      _resultPath = null;
      _parts = null;
      _bytes = null;
    });
    try {
      final formMap = <String, dynamic>{
        'file': await MultipartFile.fromFile(path),
        'mode': _mode,
      };
      if (_mode == 'ranges') {
        formMap['ranges'] = _rangesController.text.trim();
      }
      final response = await ApiClient.instance.dio.post(
        '/api/v1/pdf/split-download',
        data: FormData.fromMap(formMap),
        options: Options(
          responseType: ResponseType.bytes,
          headers: {'Accept': 'application/zip'},
        ),
      );
      final dir = await getApplicationDocumentsDirectory();
      final base = _source?.name ?? 'document.pdf';
      final stem = base.endsWith('.pdf')
          ? base.substring(0, base.length - 4)
          : base;
      final suffix = _mode == 'all' ? 'pages' : 'split';
      final out = File('${dir.path}/${stem}-${suffix}-${DateTime.now().millisecondsSinceEpoch}.zip');
      await out.writeAsBytes(response.data as List<int>);
      final size = await out.length();
      if (mounted) {
        setState(() {
          _resultPath = out.path;
          _bytes = size;
          // Server returns X-Pdf-Parts and X-Pdf-Source-Pages headers
          // (see pdf.py). Surface them to the user so they know
          // how many files to expect.
          _parts = int.tryParse(
            response.headers.value('X-Pdf-Parts') ?? '',
          );
          _sourcePages = int.tryParse(
            response.headers.value('X-Pdf-Source-Pages') ?? '',
          );
        });
      }
    } on DioException catch (e) {
      setState(() => _error = formatApiError(e.response?.data));
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text('tools.split'.tr())),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'split.subtitle'.tr(),
              style: theme.textTheme.bodyMedium,
            ),
            const SizedBox(height: 24),
            FilePickerField(
              file: _source,
              onPick: _pickFile,
              onClear: _source == null
                  ? null
                  : () => setState(() {
                        _source = null;
                        _resultPath = null;
                        _error = null;
                      }),
            ),
            const SizedBox(height: 24),
            Text('split.mode'.tr(), style: theme.textTheme.titleSmall),
            const SizedBox(height: 8),
            SegmentedButton<String>(
              segments: [
                ButtonSegment(
                  value: 'all',
                  label: Text('split.mode_all'.tr()),
                  icon: const Icon(Icons.copy_all),
                ),
                ButtonSegment(
                  value: 'ranges',
                  label: Text('split.mode_ranges'.tr()),
                  icon: const Icon(Icons.content_cut),
                ),
              ],
              selected: {_mode},
              onSelectionChanged: (s) => setState(() => _mode = s.first),
            ),
            const SizedBox(height: 16),
            if (_mode == 'ranges') ...[
              TextField(
                controller: _rangesController,
                keyboardType: TextInputType.text,
                autocorrect: false,
                decoration: InputDecoration(
                  labelText: 'split.ranges'.tr(),
                  hintText: '1-3,5,7-9',
                  helperText: 'split.ranges_hint'.tr(),
                  prefixIcon: const Icon(Icons.numbers),
                  border: const OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
            ],
            if (_error != null) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: theme.colorScheme.errorContainer,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Icon(Icons.error_outline, color: theme.colorScheme.onErrorContainer),
                    const SizedBox(width: 8),
                    Expanded(child: Text(_error!)),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],
            FilledButton.icon(
              onPressed: (_busy || _source == null) ? null : _doSplit,
              icon: _busy
                  ? const SizedBox(
                      width: 16, height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.call_split),
              label: Text('split.start_split'.tr()),
            ),
            if (_resultPath != null) ...[
              const SizedBox(height: 24),
              Card(
                elevation: 0,
                color: theme.colorScheme.primaryContainer.withValues(alpha: 0.3),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.check_circle),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _parts != null
                                  ? 'split.complete'.tr(namedArgs: {'parts': '$_parts'})
                                  : 'Split complete',
                            ),
                          ),
                        ],
                      ),
                      if (_sourcePages != null) ...[
                        const SizedBox(height: 8),
                        Text(
                          'split.source_pages'.tr(namedArgs: {
                            'pages': '$_sourcePages',
                          }),
                        ),
                      ],
                      const SizedBox(height: 4),
                      Text(
                        _formatBytes(_bytes ?? 0),
                        style: theme.textTheme.bodySmall,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _resultPath!,
                        style: theme.textTheme.bodySmall,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _formatBytes(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / 1024 / 1024).toStringAsFixed(1)} MB';
  }
}
