import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'mfa_service.dart';

/// Post-password-sign-in MFA challenge screen.
///
/// We land here only when [MfaService.listFactors] returns a
/// non-empty set. The screen has two modes:
///   - Default: a single 6-digit code field for TOTP factors, with
///     a "Use a passkey instead" button if at least one passkey
///     exists on the device.
///   - Passkey mode: hides the code field, shows a biometric prompt
///     driven by the `webauthn` package, and falls back to TOTP on
///     cancel.
///
/// On success we navigate to [returnTo] (default: /dashboard).
class MfaLoginPromptPage extends ConsumerStatefulWidget {
  const MfaLoginPromptPage({super.key, this.returnTo});

  /// Where to land after a successful MFA challenge. Same
  /// open-redirect guardrails as the login page.
  final String? returnTo;

  @override
  ConsumerState<MfaLoginPromptPage> createState() => _MfaLoginPromptPageState();
}

class _MfaLoginPromptPageState extends ConsumerState<MfaLoginPromptPage> {
  final _codeController = TextEditingController();
  bool _passkeyMode = false;
  bool _busy = false;
  String? _error;
  List<MfaFactor> _factors = const [];
  bool _loadingFactors = true;

  @override
  void initState() {
    super.initState();
    _loadFactors();
  }

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  String _landing() {
    final rt = widget.returnTo;
    if (rt == null || rt.isEmpty) return '/dashboard';
    if (!rt.startsWith('/') || rt.startsWith('//')) return '/dashboard';
    return rt;
  }

  Future<void> _loadFactors() async {
    try {
      final factors = await ref.read(mfaServiceProvider).listFactors();
      if (!mounted) return;
      // If there are no factors, bounce — the user doesn't need MFA.
      if (factors.whereType<TotpFactor>().isEmpty &&
          factors.whereType<PasskeyFactor>().isEmpty) {
        context.go(_landing());
        return;
      }
      setState(() {
        _factors = factors;
        _loadingFactors = false;
        // Default to TOTP if any TOTP factor is present, otherwise
        // fall back to passkey.
        _passkeyMode = factors.whereType<TotpFactor>().isEmpty &&
            factors.whereType<PasskeyFactor>().isNotEmpty;
      });
      if (_passkeyMode) {
        // Auto-trigger the biometric prompt for a smoother UX.
        unawaited(_runPasskeyAssertion());
      }
    } catch (_) {
      if (!mounted) return;
      // If we can't even list factors, just bounce.
      context.go(_landing());
    }
  }

  Future<void> _runTotpChallenge() async {
    final code = _codeController.text.trim();
    if (code.length != 6 || int.tryParse(code) == null) {
      setState(() => _error = 'security.mfa_invalid_code'.tr());
      return;
    }
    final totp = _factors.whereType<TotpFactor>().firstOrNull;
    if (totp == null) {
      setState(() => _error = 'security.totp_no_factors'.tr());
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(mfaServiceProvider).verifyTotpEnrollment(totp.id, code);
      if (!mounted) return;
      context.go(_landing());
    } on AuthException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _runPasskeyAssertion() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await ref.read(mfaServiceProvider).assertPasskey();
      if (!mounted) return;
      if (result.success) {
        context.go(_landing());
        return;
      }
      // The user cancelled or no passkey matched — fall back to TOTP.
      setState(() {
        _passkeyMode = false;
        _error = 'security.mfa_cancelled'.tr();
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _passkeyMode = false;
        _error = e.toString();
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (_loadingFactors) {
      return const Scaffold(
        body: SafeArea(
          child: Center(child: CircularProgressIndicator()),
        ),
      );
    }
    final hasTotp = _factors.any((f) => f is TotpFactor);
    final hasPasskey = _factors.any((f) => f is PasskeyFactor);
    return Scaffold(
      appBar: AppBar(title: Text('security.mfa_required_title'.tr())),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 12),
              Text(
                'security.mfa_required_body'.tr(),
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),
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
                      Expanded(
                        child: Text(
                          _error!,
                          style: TextStyle(
                            color: theme.colorScheme.onErrorContainer,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],
              if (!_passkeyMode && hasTotp) ...[
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
                    counterText: '',
                    border: const OutlineInputBorder(),
                  ),
                  onSubmitted: (_) => _runTotpChallenge(),
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: _busy ? null : _runTotpChallenge,
                  child: _busy
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text('security.totp_verify'.tr()),
                ),
              ],
              if (_passkeyMode) ...[
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: theme.colorScheme.primaryContainer,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    children: [
                      Icon(
                        Icons.fingerprint,
                        size: 64,
                        color: theme.colorScheme.onPrimaryContainer,
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'security.passkey_signin_prompt'.tr(),
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: theme.colorScheme.onPrimaryContainer,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                FilledButton.icon(
                  onPressed: _busy ? null : _runPasskeyAssertion,
                  icon: const Icon(Icons.fingerprint),
                  label: Text('security.passkey_use'.tr()),
                ),
              ],
              if (hasTotp && hasPasskey) ...[
                const SizedBox(height: 16),
                TextButton.icon(
                  onPressed: _busy
                      ? null
                      : () => setState(() {
                            _passkeyMode = !_passkeyMode;
                            _error = null;
                            if (_passkeyMode) {
                              unawaited(_runPasskeyAssertion());
                            }
                          }),
                  icon: Icon(
                    _passkeyMode
                        ? Icons.password
                        : Icons.fingerprint,
                  ),
                  label: Text(
                    _passkeyMode
                        ? 'security.mfa_use_totp'.tr()
                        : 'security.mfa_use_passkey'.tr(),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
