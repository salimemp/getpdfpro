import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:easy_localization/easy_localization.dart';

import '../auth/mfa/mfa_service.dart';

/// Security & sign-in settings page.
///
/// Three sections:
///   1. TOTP authenticator-app factors — enroll new, view existing,
///      verify on enroll, show 10 backup codes on first verify.
///   2. Passkeys (WebAuthn) — add a new device-bound credential,
///      list existing, remove.
///   3. Recovery codes — regenerate (we can't recover lost ones
///      server-side yet, but the UI offers the action).
///
/// The page lives at `/settings/security` and is reachable from
/// the main `/settings` page via a new "Security & sign-in" tile.
class SecurityPage extends ConsumerStatefulWidget {
  const SecurityPage({super.key});

  @override
  ConsumerState<SecurityPage> createState() => _SecurityPageState();
}

class _SecurityPageState extends ConsumerState<SecurityPage> {
  @override
  void initState() {
    super.initState();
    // Refresh the factor list every time we land on the page —
    // covers the case where the user backs out of the MFA prompt
    // and lands here.
    Future.microtask(() {
      if (mounted) ref.invalidate(mfaFactorsProvider);
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final factorsAsync = ref.watch(mfaFactorsProvider);
    return Scaffold(
      appBar: AppBar(title: Text('security.title'.tr())),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(mfaFactorsProvider);
          await ref.read(mfaFactorsProvider.future);
        },
        child: ListView(
          children: [
            // ─── About ─────────────────────────────────────────
            _SectionHeader('security.section_about'.tr()),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Text(
                'security.about_body'.tr(),
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ),
            const Divider(),

            // ─── TOTP section ──────────────────────────────────
            _SectionHeader('security.section_totp'.tr()),
            factorsAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.all(16),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (e, _) => Padding(
                padding: const EdgeInsets.all(16),
                child: Text(
                  e.toString(),
                  style: TextStyle(color: theme.colorScheme.error),
                ),
              ),
              data: (factors) {
                final totps = factors.whereType<TotpFactor>().toList();
                return Column(
                  children: [
                    if (totps.isEmpty)
                      ListTile(
                        leading: const Icon(Icons.qr_code),
                        title: Text('security.totp_no_factors'.tr()),
                      )
                    else
                      for (final f in totps)
                        ListTile(
                          leading: const Icon(Icons.verified_user),
                          title: Text(f.friendlyName),
                          subtitle: Text(
                            'security.totp_factor_label'.tr(
                              namedArgs: {
                                'name': f.friendlyName,
                                'date': '',
                              },
                            ),
                          ),
                          trailing: IconButton(
                            icon: const Icon(Icons.delete_outline),
                            tooltip: 'security.totp_remove'.tr(),
                            onPressed: () => _confirmUnenroll(f),
                          ),
                        ),
                    Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 8,
                      ),
                      child: Align(
                        alignment: Alignment.centerLeft,
                        child: FilledButton.icon(
                          onPressed: () => _enrollTotp(context),
                          icon: const Icon(Icons.add),
                          label: Text('security.totp_enroll'.tr()),
                        ),
                      ),
                    ),
                  ],
                );
              },
            ),
            const Divider(),

            // ─── Passkeys section ──────────────────────────────
            _SectionHeader('security.section_passkeys'.tr()),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Container(
                key: const Key('passkey-per-device-info'),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: theme.colorScheme.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      Icons.info_outline,
                      size: 18,
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'security.passkey_per_device_info'.tr(),
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            factorsAsync.when(
              loading: () => const SizedBox.shrink(),
              error: (_, __) => const SizedBox.shrink(),
              data: (factors) {
                final passkeys = factors.whereType<PasskeyFactor>().toList();
                return Column(
                  children: [
                    if (passkeys.isEmpty)
                      ListTile(
                        leading: const Icon(Icons.fingerprint),
                        title: Text('security.passkey_no_passkeys'.tr()),
                      )
                    else
                      for (final p in passkeys)
                        ListTile(
                          leading: const Icon(Icons.fingerprint),
                          title: Text(p.friendlyName),
                          subtitle: Text(
                            'security.passkey_factor_label'.tr(
                              namedArgs: {
                                'name': p.friendlyName,
                                'date': '',
                              },
                            ),
                          ),
                          trailing: IconButton(
                            icon: const Icon(Icons.delete_outline),
                            tooltip: 'security.passkey_remove'.tr(),
                            onPressed: () => _confirmUnenroll(p),
                          ),
                        ),
                    Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 8,
                      ),
                      child: Align(
                        alignment: Alignment.centerLeft,
                        child: FilledButton.icon(
                          onPressed: () => _enrollPasskey(context),
                          icon: const Icon(Icons.add),
                          label: Text('security.passkey_add'.tr()),
                        ),
                      ),
                    ),
                  ],
                );
              },
            ),
            const Divider(),

            // ─── Recovery codes section ────────────────────────
            _SectionHeader('security.section_recovery'.tr()),
            ListTile(
              leading: const Icon(Icons.vpn_key),
              title: Text('security.regenerate'.tr()),
              subtitle: Text('security.backup_codes_body'.tr()),
              onTap: () => _showBackupCodes(context),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Future<void> _enrollTotp(BuildContext context) async {
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context, rootNavigator: true);
    // Show a "generating" snackbar that we'll replace on result.
    messenger.showSnackBar(
      SnackBar(content: Text('security.totp_enrolling'.tr())),
    );
    try {
      final enrollment = await ref
          .read(mfaServiceProvider)
          .enrollTotp('Authenticator app');
      ref.invalidate(mfaFactorsProvider);
      if (!mounted) return;
      // The State's `context` getter is the same BuildContext that
      // `build()` receives; using it here keeps the analyzer happy
      // because the `mounted` guard applies to it.
      // Show the QR + verify code bottom sheet. We use showModalBottomSheet
      // (not a route push) so the user can swipe down to cancel.
      await showModalBottomSheet<void>(
        context: this.context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (ctx) => _TotpEnrollmentSheet(
          enrollment: enrollment,
          onVerified: () {
            navigator.pop();
            ref.invalidate(mfaFactorsProvider);
            _showBackupCodes(this.context);
          },
        ),
      );
    } on AuthException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    } on MfaException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  Future<void> _enrollPasskey(BuildContext context) async {
    final messenger = ScaffoldMessenger.of(context);
    // Use a stateful dialog so the TextEditingController lifecycle
    // is owned by the dialog's State — disposing it manually here
    // is racy because the dialog's TextField might still be
    // listening when we call dispose().
    final friendlyName = await showDialog<String>(
      context: context,
      builder: (ctx) => const _PasskeyNameDialog(),
    );
    if (friendlyName == null || friendlyName.isEmpty || !mounted) return;
    messenger.showSnackBar(
      SnackBar(content: Text('security.passkey_adding'.tr())),
    );
    try {
      await ref
          .read(mfaServiceProvider)
          .registerPasskey(friendlyName);
      ref.invalidate(mfaFactorsProvider);
      if (mounted) {
        messenger.showSnackBar(
          SnackBar(content: Text(friendlyName)),
        );
      }
    } on MfaException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  Future<void> _confirmUnenroll(MfaFactor factor) async {
    final isPasskey = factor is PasskeyFactor;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(
          isPasskey
              ? 'security.passkey_confirm_remove_title'.tr()
              : 'security.totp_confirm_remove_title'.tr(),
        ),
        content: Text(
          isPasskey
              ? 'security.passkey_confirm_remove_body'.tr()
              : 'security.totp_confirm_remove_body'.tr(),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text('common.cancel'.tr()),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text('common.delete'.tr()),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await ref.read(mfaServiceProvider).unenrollFactor(factor.id);
      ref.invalidate(mfaFactorsProvider);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString())));
      }
    }
  }

  Future<void> _showBackupCodes(BuildContext context) async {
    final codes = ref.read(mfaServiceProvider).generateBackupCodes();
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('security.backup_codes_title'.tr()),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('security.backup_codes_body'.tr()),
              const SizedBox(height: 16),
              for (final code in codes)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 2),
                  child: SelectableText(
                    code,
                    style: Theme.of(ctx).textTheme.titleMedium?.copyWith(
                          fontFeatures: const [
                            FontFeature.tabularFigures(),
                          ],
                          letterSpacing: 2,
                        ),
                  ),
                ),
            ],
          ),
        ),
        actions: [
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text('security.backup_codes_done'.tr()),
          ),
        ],
      ),
    );
  }
}

/// Bottom sheet that shows the TOTP QR code + a 6-digit code input
/// for verification. On verify success, calls [onVerified] and
/// pops itself.
class _TotpEnrollmentSheet extends ConsumerStatefulWidget {
  const _TotpEnrollmentSheet({
    required this.enrollment,
    required this.onVerified,
  });
  final MfaTotpEnrollment enrollment;
  final VoidCallback onVerified;

  @override
  ConsumerState<_TotpEnrollmentSheet> createState() =>
      _TotpEnrollmentSheetState();
}

class _TotpEnrollmentSheetState
    extends ConsumerState<_TotpEnrollmentSheet> {
  final _codeController = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    final code = _codeController.text.trim();
    if (code.length != 6) {
      setState(() => _error = 'security.mfa_invalid_code'.tr());
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref
          .read(mfaServiceProvider)
          .verifyTotpEnrollment(widget.enrollment.factorId, code);
      widget.onVerified();
    } on AuthException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 8,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'security.totp_enroll'.tr(),
            style: theme.textTheme.titleLarge,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            'security.totp_scan'.tr(),
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          Center(
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
              ),
              child: QrImageView(
                data: widget.enrollment.uri,
                size: 220,
                version: QrVersions.auto,
                backgroundColor: Colors.white,
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'security.totp_secret_label'.tr(),
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 4),
          SelectableText(
            widget.enrollment.secret,
            style: theme.textTheme.titleMedium?.copyWith(
              fontFeatures: const [FontFeature.tabularFigures()],
              letterSpacing: 2,
            ),
          ),
          const SizedBox(height: 24),
          TextField(
            controller: _codeController,
            keyboardType: TextInputType.number,
            inputFormatters: [
              FilteringTextInputFormatter.digitsOnly,
              LengthLimitingTextInputFormatter(6),
            ],
            textAlign: TextAlign.center,
            style: theme.textTheme.headlineSmall?.copyWith(
              letterSpacing: 8,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
            decoration: InputDecoration(
              labelText: 'security.totp_code_hint'.tr(),
              border: const OutlineInputBorder(),
              errorText: _error,
            ),
            onSubmitted: (_) => _verify(),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _busy ? null : _verify,
            child: _busy
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text('security.totp_verify'.tr()),
          ),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Text(
        text.toUpperCase(),
        style: theme.textTheme.labelMedium?.copyWith(
          color: theme.colorScheme.primary,
          letterSpacing: 1.1,
        ),
      ),
    );
  }
}

/// Stateful dialog that asks the user for a friendly name for a
/// new passkey. Owns the TextEditingController so the dispose()
/// lifecycle is unambiguous.
class _PasskeyNameDialog extends StatefulWidget {
  const _PasskeyNameDialog();
  @override
  State<_PasskeyNameDialog> createState() => _PasskeyNameDialogState();
}

class _PasskeyNameDialogState extends State<_PasskeyNameDialog> {
  late final TextEditingController _controller = TextEditingController(
    text: 'Passkey ${DateTime.now().millisecondsSinceEpoch ~/ 1000}',
  );

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text('security.passkey_add'.tr()),
      content: TextField(
        controller: _controller,
        autofocus: true,
        decoration: InputDecoration(
          labelText: 'security.passkey_name_hint'.tr(),
          border: const OutlineInputBorder(),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text('common.cancel'.tr()),
        ),
        FilledButton(
          onPressed: () =>
              Navigator.of(context).pop(_controller.text.trim()),
          child: Text('security.passkey_add'.tr()),
        ),
      ],
    );
  }
}
