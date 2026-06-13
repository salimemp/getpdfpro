import 'dart:io';

import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:path_provider/path_provider.dart';

import '../../core/api_client.dart';
import 'widgets/file_picker_field.dart';

/// Field type discriminator for [ToolFormField]. Public so
/// other tool page files can construct fields.
enum FieldType { text, multiline, dropdown, toggle }

/// Configuration for a single tool page that follows the
/// "pick a PDF + optional form fields + submit + save result"
/// pattern. The 26 PDF tools that don't have a custom UI
/// (everything except the 8 special cases) use this.
///
/// Customize via the optional form fields + form values map.
/// The page builds a standard file picker at the top, then a
/// dynamically generated list of form fields from [formFields],
/// then a primary action button.
class ToolFormField {
  const ToolFormField({
    required this.id,
    required this.label,
    this.hint,
    this.type = FieldType.text,
    this.options,
    this.required = false,
    this.maxLines = 1,
  });

  final String id;
  final String label;
  final String? hint;
  final FieldType type;
  final List<String>? options;
  final bool required;
  final int maxLines;
}

/// A standardized tool page. Use this for any tool whose API
/// takes a `file` multipart upload plus zero or more extra form
/// fields.
///
/// The page:
///   1. Renders a [FilePickerField] at the top.
///   2. Renders each [ToolFormField] as the appropriate input.
///   3. On submit, POSTs to [endpoint] via [ApiClient] with the
///      form data, then writes the response bytes to the
///      documents directory.
///   4. Shows a success card with the output filename and
///      size.
///
/// If the endpoint returns application/zip (e.g. split), the
/// file gets a .zip extension; otherwise .pdf.
class StandardToolPage extends StatefulWidget {
  const StandardToolPage({
    super.key,
    required this.title,
    required this.subtitle,
    required this.endpoint,
    required this.formFields,
    this.submitLabel,
    this.actionIcon = Icons.arrow_forward,
    this.suggestedFileSuffix = '-output',
    this.outputExtension = 'pdf',
    this.preSubmitValidation,
  });

  /// Title shown in the AppBar.
  final String title;

  /// One-line description shown below the title.
  final String subtitle;

  /// The API endpoint path, e.g. `/api/v1/pdf/compress-download`.
  final String endpoint;

  /// Form fields shown between the file picker and the
  /// submit button. Empty list = no extra fields.
  final List<ToolFormField> formFields;

  /// Label for the submit button. Defaults to "Run".
  final String? submitLabel;

  /// Icon for the submit button.
  final IconData actionIcon;

  /// Filename suffix used when building the output path, e.g.
  /// "compressed" → "<stem>-compressed-<ts>.pdf".
  final String suggestedFileSuffix;

  /// Output file extension. "pdf" (default) or "zip".
  final String outputExtension;

  /// Optional validation hook called before the API call. If
  /// it returns a non-null string, the page shows that as an
  /// error and skips the API call.
  final String? Function(Map<String, dynamic> formValues)?
      preSubmitValidation;

  @override
  State<StandardToolPage> createState() => _StandardToolPageState();
}

class _StandardToolPageState extends State<StandardToolPage> {
  PlatformFile? _source;
  final _controllers = <String, TextEditingController>{};
  String? _dropdownValue;
  bool _busy = false;
  String? _error;
  String? _resultPath;
  int? _resultBytes;
  int? _resultParts;
  int? _resultSourcePages;

  @override
  void initState() {
    super.initState();
    for (final f in widget.formFields) {
      if (f.type == FieldType.text || f.type == FieldType.multiline) {
        _controllers[f.id] = TextEditingController();
      }
    }
  }

  @override
  void dispose() {
    for (final c in _controllers.values) {
      c.dispose();
    }
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
      });
    } catch (e) {
      setState(() => _error = 'Could not open file picker: $e');
    }
  }

  Future<void> _doSubmit() async {
    final path = _source?.path;
    if (path == null) {
      setState(() => _error = 'Pick a PDF first');
      return;
    }
    final file = File(path);
    if (!await file.exists()) {
      setState(() => _error = 'File not found: $path');
      return;
    }
    // Collect form values
    final formValues = <String, dynamic>{};
    for (final f in widget.formFields) {
      switch (f.type) {
        case FieldType.text:
        case FieldType.multiline:
          formValues[f.id] = _controllers[f.id]?.text ?? '';
          if (f.required && (formValues[f.id] as String).isEmpty) {
            setState(() => _error = '${f.label} is required');
            return;
          }
          break;
        case FieldType.dropdown:
          formValues[f.id] = _dropdownValue;
          if (f.required && (formValues[f.id] == null ||
              (formValues[f.id] as String).isEmpty)) {
            setState(() => _error = '${f.label} is required');
            return;
          }
          break;
        case FieldType.toggle:
          formValues[f.id] = false; // Default to false; we use a custom switch
          break;
      }
    }
    if (widget.preSubmitValidation != null) {
      final err = widget.preSubmitValidation!(formValues);
      if (err != null) {
        setState(() => _error = err);
        return;
      }
    }
    setState(() {
      _busy = true;
      _error = null;
      _resultPath = null;
    });
    try {
      final formMap = <String, dynamic>{
        'file': await MultipartFile.fromFile(path),
        ...formValues,
      };
      final response = await ApiClient.instance.dio.post(
        widget.endpoint,
        data: FormData.fromMap(formMap),
        options: Options(responseType: ResponseType.bytes),
      );
      final dir = await getApplicationDocumentsDirectory();
      final base = _source?.name ?? 'document.pdf';
      final stem = base.endsWith('.pdf')
          ? base.substring(0, base.length - 4)
          : base;
      final outName = '$stem${widget.suggestedFileSuffix}-'
          '${DateTime.now().millisecondsSinceEpoch}.'
          '${widget.outputExtension}';
      final out = File('${dir.path}/$outName');
      await out.writeAsBytes(response.data as List<int>);
      final size = await out.length();
      if (mounted) {
        setState(() {
          _resultPath = out.path;
          _resultBytes = size;
          _resultParts = int.tryParse(
            response.headers.value('X-Pdf-Parts') ?? '',
          );
          _resultSourcePages = int.tryParse(
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
      appBar: AppBar(title: Text(widget.title)),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(widget.subtitle, style: theme.textTheme.bodyMedium),
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
            const SizedBox(height: 16),
            ...widget.formFields.map((f) => Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: _buildField(f),
                )),
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
              onPressed: (_busy || _source == null) ? null : _doSubmit,
              icon: _busy
                  ? const SizedBox(
                      width: 16, height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Icon(widget.actionIcon),
              label: Text(widget.submitLabel ?? 'Run'),
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
                              _resultParts != null
                                  ? 'Done — split into $_resultParts parts'
                                  : 'Done',
                            ),
                          ),
                        ],
                      ),
                      if (_resultSourcePages != null) ...[
                        const SizedBox(height: 4),
                        Text('Source: $_resultSourcePages pages'),
                      ],
                      const SizedBox(height: 4),
                      Text(_formatBytes(_resultBytes ?? 0)),
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

  Widget _buildField(ToolFormField f) {
    switch (f.type) {
      case FieldType.text:
        return TextField(
          controller: _controllers[f.id],
          decoration: InputDecoration(
            labelText: f.label,
            hintText: f.hint,
            border: const OutlineInputBorder(),
          ),
        );
      case FieldType.multiline:
        return TextField(
          controller: _controllers[f.id],
          maxLines: f.maxLines,
          decoration: InputDecoration(
            labelText: f.label,
            hintText: f.hint,
            border: const OutlineInputBorder(),
          ),
        );
      case FieldType.dropdown:
        return DropdownButtonFormField<String>(
          value: _dropdownValue,
          decoration: InputDecoration(
            labelText: f.label,
            border: const OutlineInputBorder(),
          ),
          items: (f.options ?? const [])
              .map((o) => DropdownMenuItem(value: o, child: Text(o)))
              .toList(),
          onChanged: (v) => setState(() => _dropdownValue = v),
        );
      case FieldType.toggle:
        return SwitchListTile(
          value: false,
          onChanged: (_) {},
          title: Text(f.label),
          contentPadding: EdgeInsets.zero,
        );
    }
  }

  String _formatBytes(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / 1024 / 1024).toStringAsFixed(1)} MB';
  }
}
