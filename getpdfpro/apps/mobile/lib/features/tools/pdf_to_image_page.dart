import 'dart:io';

import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:path_provider/path_provider.dart';

import '../../core/api_client.dart';
import 'widgets/file_picker_field.dart';

/// PDF to image tool page.
///
/// The server returns a ZIP of PNG/JPEG images (one per page). We
/// save it to the documents directory and surface the file path to
/// the user.
///
/// Same UX as Compress: system file picker, file name + size shown
/// inline, format (PNG/JPEG) + DPI controls below.
class PdfToImagePage extends StatefulWidget {
  const PdfToImagePage({super.key});

  @override
  State<PdfToImagePage> createState() => _PdfToImagePageState();
}

class _PdfToImagePageState extends State<PdfToImagePage> {
  PlatformFile? _source;
  String _format = 'png';
  int _dpi = 150;
  bool _busy = false;
  String? _resultPath;
  String? _error;
  int? _pages;
  int? _bytes;

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
        _pages = null;
        _bytes = null;
      });
    } catch (e) {
      setState(() => _error = 'Could not open file picker: $e');
    }
  }

  String? _sourcePath() => _source?.path;

  Future<void> _doConvert() async {
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
    setState(() {
      _busy = true;
      _error = null;
      _resultPath = null;
      _pages = null;
      _bytes = null;
    });
    try {
      final form = FormData.fromMap({
        'file': await MultipartFile.fromFile(path),
        'format': _format,
        'dpi': _dpi,
      });
      final response = await ApiClient.instance.dio.post(
        '/api/v1/pdf/to-image',
        data: form,
        options: Options(
          responseType: ResponseType.bytes,
          headers: {'Accept': 'application/zip'},
        ),
      );
      final dir = await getApplicationDocumentsDirectory();
      final base = _source?.name ?? 'images.zip';
      final stem = base.endsWith('.pdf')
          ? base.substring(0, base.length - 4)
          : base;
      final out = File(
        '${dir.path}/${stem}-${_format}-${DateTime.now().millisecondsSinceEpoch}.zip',
      );
      await out.writeAsBytes(response.data as List<int>);
      final size = await out.length();
      if (mounted) {
        setState(() {
          _resultPath = out.path;
          _bytes = size;
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
      appBar: AppBar(title: Text('tools.pdf_to_image'.tr())),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'pdf_to_image.subtitle'.tr(),
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
            Text('pdf_to_image.format'.tr(), style: theme.textTheme.titleSmall),
            const SizedBox(height: 8),
            SegmentedButton<String>(
              segments: [
                ButtonSegment(
                  value: 'png',
                  label: Text('pdf_to_image.format_png'.tr()),
                ),
                ButtonSegment(
                  value: 'jpeg',
                  label: Text('pdf_to_image.format_jpeg'.tr()),
                ),
              ],
              selected: {_format},
              onSelectionChanged: (s) => setState(() => _format = s.first),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(child: Text('pdf_to_image.dpi'.tr())),
                Text('$_dpi'),
                Expanded(
                  flex: 3,
                  child: Slider(
                    value: _dpi.toDouble(),
                    min: 72,
                    max: 300,
                    divisions: 8,
                    label: '$_dpi DPI',
                    onChanged: (v) => setState(() => _dpi = v.round()),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            if (_error != null) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: theme.colorScheme.errorContainer,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.error_outline,
                      color: theme.colorScheme.onErrorContainer,
                    ),
                    const SizedBox(width: 8),
                    Expanded(child: Text(_error!)),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],
            FilledButton.icon(
              onPressed: (_busy || _source == null) ? null : _doConvert,
              icon: _busy
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.image),
              label: Text('pdf_to_image.start_convert'.tr()),
            ),
            if (_resultPath != null) ...[
              const SizedBox(height: 24),
              Card(
                elevation: 0,
                color: theme.colorScheme.primaryContainer.withValues(
                  alpha: 0.3,
                ),
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
                              _pages != null
                                  ? 'pdf_to_image.complete'.tr(
                                      namedArgs: {'pages': '$_pages'},
                                    )
                                  : 'Saved ${_formatBytes(_bytes!)} ZIP',
                            ),
                          ),
                        ],
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
