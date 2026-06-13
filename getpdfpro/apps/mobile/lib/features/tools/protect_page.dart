import 'dart:io';

import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:path_provider/path_provider.dart';

import '../../core/api_client.dart';
import 'widgets/file_picker_field.dart';

/// Protect PDF tool page — encrypts a PDF with a user password
/// (and optional owner password + permissions).
///
/// Calls `POST /api/v1/security/protect-download` with form fields:
///
///   - `file` — the PDF to encrypt
///   - `user_password` — required, the password to open the PDF
///   - `owner_password` — optional, defaults to user_password
///   - `permissions` — optional comma-separated whitelist
///     ("print,copy,modify,...") of allowed actions; blank means
///     default-deny except accessibility (so screen readers
///     still work — required by section 508 / WCAG / EU laws)
///
/// SECURITY: The password is sent over HTTPS to the production
/// API. We do NOT log the password, do NOT write it to a file,
/// and clear the local controllers when the user navigates
/// away. The TextField is `obscureText` by default with a
/// tap-to-reveal toggle.
class ProtectPage extends StatefulWidget {
  const ProtectPage({super.key});

  @override
  State<ProtectPage> createState() => _ProtectPageState();
}

class _ProtectPageState extends State<ProtectPage> {
  PlatformFile? _source;
  final _userPasswordController = TextEditingController();
  final _ownerPasswordController = TextEditingController();

  bool _showUserPassword = false;
  bool _showOwnerPassword = false;
  bool _useSeparateOwner = false;

  /// Map of permission name -> allowed. Server defaults to
  /// deny-all-except-accessibility. We expose the same.
  /// `null` means "use server default" (no whitelist).
  final Map<String, bool> _permissions = {
    'print': false,
    'print_highres': false,
    'modify': false,
    'copy': false,
    'annotate': false,
    'forms': false,
    'assemble': false,
  };

  bool _busy = false;
  String? _resultPath;
  String? _error;
  int? _bytes;

  @override
  void dispose() {
    // Wipe the password controllers on dispose. This is
    // defense-in-depth — the OS reclaims the buffer when the
    // GC runs, but explicitly clearing right now is the polite
    // thing to do.
    _userPasswordController.clear();
    _ownerPasswordController.clear();
    _userPasswordController.dispose();
    _ownerPasswordController.dispose();
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
        _bytes = null;
      });
    } catch (e) {
      setState(() => _error = 'Could not open file picker: $e');
    }
  }

  String? _sourcePath() => _source?.path;

  Future<void> _doProtect() async {
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
    final userPw = _userPasswordController.text;
    if (userPw.length < 4) {
      setState(() => _error = 'protect.password_too_short'.tr());
      return;
    }
    if (userPw.length > 128) {
      setState(() => _error = 'protect.password_too_long'.tr());
      return;
    }
    final ownerPw = _useSeparateOwner
        ? _ownerPasswordController.text
        : userPw;
    if (_useSeparateOwner && ownerPw.length < 4) {
      setState(() => _error = 'protect.owner_password_too_short'.tr());
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _resultPath = null;
      _bytes = null;
    });
    try {
      // Build the permissions whitelist from the toggle state.
      // Empty whitelist → server applies its default (deny
      // everything except accessibility).
      final allowed = <String>[];
      _permissions.forEach((name, isAllowed) {
        if (isAllowed) allowed.add(name);
      });
      final formMap = <String, dynamic>{
        'file': await MultipartFile.fromFile(path),
        'user_password': userPw,
        'owner_password': ownerPw,
        'permissions': allowed.join(','),
      };
      final response = await ApiClient.instance.dio.post(
        '/api/v1/security/protect-download',
        data: FormData.fromMap(formMap),
        options: Options(responseType: ResponseType.bytes),
      );
      final dir = await getApplicationDocumentsDirectory();
      final base = _source?.name ?? 'document.pdf';
      final stem = base.endsWith('.pdf')
          ? base.substring(0, base.length - 4)
          : base;
      final out = File('${dir.path}/${stem}-protected-${DateTime.now().millisecondsSinceEpoch}.pdf');
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
      appBar: AppBar(title: Text('tools.protect'.tr())),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'protect.subtitle'.tr(),
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
            TextField(
              controller: _userPasswordController,
              obscureText: !_showUserPassword,
              autocorrect: false,
              textCapitalization: TextCapitalization.none,
              decoration: InputDecoration(
                labelText: 'protect.user_password'.tr(),
                helperText: 'protect.password_helper'.tr(),
                prefixIcon: const Icon(Icons.lock),
                suffixIcon: IconButton(
                  icon: Icon(_showUserPassword
                      ? Icons.visibility_off
                      : Icons.visibility),
                  onPressed: () =>
                      setState(() => _showUserPassword = !_showUserPassword),
                ),
                border: const OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 8),
            SwitchListTile(
              value: _useSeparateOwner,
              onChanged: (v) => setState(() => _useSeparateOwner = v),
              title: Text('protect.use_separate_owner'.tr()),
              subtitle: Text('protect.use_separate_owner_hint'.tr()),
              contentPadding: EdgeInsets.zero,
            ),
            if (_useSeparateOwner) ...[
              const SizedBox(height: 8),
              TextField(
                controller: _ownerPasswordController,
                obscureText: !_showOwnerPassword,
                autocorrect: false,
                textCapitalization: TextCapitalization.none,
                decoration: InputDecoration(
                  labelText: 'protect.owner_password'.tr(),
                  helperText: 'protect.owner_password_helper'.tr(),
                  prefixIcon: const Icon(Icons.admin_panel_settings),
                  suffixIcon: IconButton(
                    icon: Icon(_showOwnerPassword
                        ? Icons.visibility_off
                        : Icons.visibility),
                    onPressed: () => setState(
                        () => _showOwnerPassword = !_showOwnerPassword),
                  ),
                  border: const OutlineInputBorder(),
                ),
              ),
            ],
            const SizedBox(height: 16),
            Text('protect.permissions'.tr(), style: theme.textTheme.titleSmall),
            const SizedBox(height: 4),
            Text(
              'protect.permissions_hint'.tr(),
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 8),
            ..._permissions.entries.map((entry) => SwitchListTile(
                  value: entry.value,
                  onChanged: (v) => setState(() {
                    _permissions[entry.key] = v;
                  }),
                  title: Text('protect.perm.${entry.key}'.tr()),
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                )),
            if (_error != null) ...[
              const SizedBox(height: 16),
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
            ],
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: (_busy || _source == null) ? null : _doProtect,
              icon: _busy
                  ? const SizedBox(
                      width: 16, height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.lock),
              label: Text('protect.start_protect'.tr()),
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
                            child: Text('protect.complete'.tr()),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(_formatBytes(_bytes ?? 0)),
                      const SizedBox(height: 8),
                      Text(
                        _resultPath!,
                        style: theme.textTheme.bodySmall,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 12),
                      // Friendly reminder: tell the user they can
                      // (and should) delete the unprotected source
                      // file. Don't show the password back.
                      Text(
                        'protect.delete_source_hint'.tr(),
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
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
