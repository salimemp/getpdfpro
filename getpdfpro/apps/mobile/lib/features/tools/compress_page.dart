import 'dart:io';

import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:path_provider/path_provider.dart';

import '../../core/api_client.dart';
import 'widgets/file_picker_field.dart';

/// Compress PDF tool page.
///
/// UX:
///   1. User taps "Pick a PDF" — opens the system file dialog scoped
///      to PDF MIME types only.
///   2. We show the file name + size next to the button so the user
///      has feedback without leaving the page.
///   3. User picks a compression level (low/medium/high).
///   4. Tapping "Compress" uploads the file via the same
///      `POST /api/v1/pdf/compress` endpoint as the web app, then
///      writes the result to the app's documents directory.
///   5. On success we show a "Saved to ..." card with the original
///      vs compressed size + percentage saved.
///
/// Multi-file is not supported here — for batch operations users
/// should hit the web app or use the merge tool first.
class CompressPage extends StatefulWidget {
  const CompressPage({super.key});

  @override
  State<CompressPage> createState() => _CompressPageState();
}

class _CompressPageState extends State<CompressPage> {
  /// The picked source file, or null if the user hasn't picked yet.
  /// We keep the entire `PlatformFile` because the path may or may
  /// not be set depending on the platform (web returns bytes, iOS
  /// returns a path under tmp, Android returns a content-URI path
  /// after copy). We always re-resolve via `XFile(path).path` to be
  /// safe.
  PlatformFile? _source;
  String _level = 'medium';
  bool _busy = false;
  String? _resultPath;
  String? _error;
  int? _originalBytes;
  int? _compressedBytes;

  /// Open the system file picker, filtered to PDFs. Works on Android,
  /// iOS, macOS, Windows, Linux. On web, FilePicker still works but
  /// returns bytes — we don't have a real mobile use case for web.
  Future<void> _pickFile() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf'],
        withData: false, // we only need the path; saves memory
        allowMultiple: false,
      );
      if (result == null || result.files.isEmpty) return;
      setState(() {
        _source = result.files.first;
        _error = null;
        _resultPath = null;
        _originalBytes = null;
        _compressedBytes = null;
      });
    } catch (e) {
      setState(() => _error = 'Could not open file picker: $e');
    }
  }

  /// Resolves the picked file's on-disk path. `PlatformFile.path` is
  /// null on some platforms (e.g. web). For the mobile/desktop use
  /// case we expect a non-null path.
  String? _sourcePath() => _source?.path;

  Future<void> _doCompress() async {
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
      _originalBytes = null;
      _compressedBytes = null;
    });
    try {
      final original = await file.length();
      final form = FormData.fromMap({
        'file': await MultipartFile.fromFile(path),
        'level': _level,
      });
      final response = await ApiClient.instance.dio.post(
        '/api/v1/pdf/compress',
        data: form,
        options: Options(responseType: ResponseType.bytes),
      );
      final dir = await getApplicationDocumentsDirectory();
      // Use the source file's basename so the user can match input
      // to output visually. Strip the .pdf extension first.
      final base = _source?.name ?? 'compressed.pdf';
      final stem = base.endsWith('.pdf')
          ? base.substring(0, base.length - 4)
          : base;
      final out = File(
        '${dir.path}/${stem}-compressed-${DateTime.now().millisecondsSinceEpoch}.pdf',
      );
      await out.writeAsBytes(response.data as List<int>);
      final compressed = await out.length();
      if (mounted) {
        setState(() {
          _resultPath = out.path;
          _originalBytes = original;
          _compressedBytes = compressed;
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

  String _pctSaved() {
    if (_originalBytes == null || _compressedBytes == null) return '';
    final saved = _originalBytes! - _compressedBytes!;
    final pct = (saved * 100 / _originalBytes!).round();
    return '$pct%';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text('tools.compress'.tr())),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('compress.subtitle'.tr(), style: theme.textTheme.bodyMedium),
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
            Text(
              'compress.level_label'.tr(),
              style: theme.textTheme.titleSmall,
            ),
            const SizedBox(height: 8),
            SegmentedButton<String>(
              segments: [
                ButtonSegment(
                  value: 'low',
                  label: Text('compress.level_low'.tr()),
                ),
                ButtonSegment(
                  value: 'medium',
                  label: Text('compress.level_medium'.tr()),
                ),
                ButtonSegment(
                  value: 'high',
                  label: Text('compress.level_high'.tr()),
                ),
              ],
              selected: {_level},
              onSelectionChanged: (s) => setState(() => _level = s.first),
            ),
            const SizedBox(height: 24),
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
              onPressed: (_busy || _source == null) ? null : _doCompress,
              icon: _busy
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.compress),
              label: Text('compress.start_compress'.tr()),
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
                              'compress.complete'.tr(
                                namedArgs: {
                                  'originalSize': _formatBytes(_originalBytes!),
                                  'newSize': _formatBytes(_compressedBytes!),
                                },
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'compress.savings'.tr(namedArgs: {'pct': _pctSaved()}),
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

/// (The `FilePickerField` widget lives in `widgets/file_picker_field.dart`
/// so it can be reused by every tool page.)
