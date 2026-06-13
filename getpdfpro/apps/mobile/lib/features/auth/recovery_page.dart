import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:easy_localization/easy_localization.dart';

/// Password-recovery page.
///
/// Flow (per Supabase's PKCE recovery pattern, March 2026):
///
///   1. User taps "Forgot password?" on the login page → we call
///      `Supabase.auth.resetPasswordForEmail(email, redirectTo:
///      getpdfpro://reset-password)`. Supabase sends a magic-link-style
///      email with the recovery URL.
///   2. User taps the link in the email. The OS opens our app via
///      the custom-scheme deep link. **The Supabase SDK's built-in
///      `_handleDeeplink()` runs during `Supabase.initialize()` and
///      exchanges the PKCE code for a session automatically** — we
///      do NOT call `verifyOTP` or `getSessionFromUrl` ourselves.
///   3. The SDK fires `AuthChangeEvent.passwordRecovery` on
///      `onAuthStateChange`. The router listens for this and
///      navigates us to `/auth/recovery`.
///   4. This page renders. We show a loading state until we
///      confirm a session is set (`Supabase.auth.currentSession`).
///   5. User types a new password + confirmation, taps "Update".
///      We call `Supabase.auth.updateUser(UserAttributes(password:))`.
///   6. On success, we land on `/dashboard`.
///
/// Why no `verifyOTP`?
/// The PKCE flow handles code-exchange server-side; manually
/// calling `verifyOTP` (or `getSessionFromUrl`) would double-process
/// the URL and fail. See supabase discussion #43284 for the full
/// explanation. The supabase_flutter SDK emits `passwordRecovery`
/// exactly when the exchange completes — that's our signal.
///
/// Why a page that *might* show "no code"?
/// Two reasons we could land here with no recovery session:
///   (a) User navigated here directly (URL bar, back button).
///   (b) Supabase's PKCE exchange failed (network, expired link).
/// In both cases we show the error state and a "Back to sign in"
/// button.
class RecoveryPage extends StatefulWidget {
  const RecoveryPage({super.key, this.code});

  /// The OTP/PKCE code from the recovery email's URL. We don't use
  /// it directly (the SDK does the exchange) but we keep it in the
  /// route params for diagnostics + for the case where the user
  /// cold-starts the app and we need to know *why* they're on this
  /// page (so the router can decide whether to wait for
  /// `passwordRecovery` or just show the error immediately).
  final String? code;

  @override
  State<RecoveryPage> createState() => _RecoveryPageState();
}

enum _Phase { verifying, ready, error }

class _RecoveryPageState extends State<RecoveryPage> {
  _Phase _phase = _Phase.verifying;
  String? _error;

  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _showPassword = false;
  bool _obscureConfirm = true;
  bool _busy = false;

  /// Tracks the auth state subscription so we can cancel it in
  /// `dispose`. The SDK may emit `passwordRecovery` after the page
  /// is built but before the form is shown — we need to react to
  /// that, not just the initial session check.
  StreamSubscription<AuthState>? _authSub;

  @override
  void initState() {
    super.initState();
    _init();
  }

  @override
  void dispose() {
    _passwordController.dispose();
    _confirmController.dispose();
    _authSub?.cancel();
    super.dispose();
  }

  /// Two parallel checks: is the session already set, and listen
  /// for the `passwordRecovery` event in case the SDK hasn't
  /// finished the PKCE exchange yet.
  ///
  /// The whole body is wrapped in a try/catch so that calling
  /// this page BEFORE `Supabase.initialize()` runs (e.g. in a
  /// test, or in a deep-link flow that races the app's own
  /// bootstrap) doesn't crash with a `_isInitialized`
  /// assertion. Instead we land on the friendly
  /// "supabase_not_initialized" error state.
  Future<void> _init() async {
    try {
      // First, peek at the current session. If the SDK already ran
      // _handleDeeplink() during initialize() AND the recovery
      // event already fired (the known race condition), we may
      // still have a session without ever seeing the event.
      final session = Supabase.instance.client.auth.currentSession;
      if (session != null) {
        // We have a session. The user can update their password.
        if (mounted) {
          setState(() {
            _phase = _Phase.ready;
            _error = null;
          });
        }
        return;
      }

      // No session yet. Wait for passwordRecovery to fire.
      _authSub = Supabase.instance.client.auth.onAuthStateChange.listen((data) {
        final event = data.event;
        if (event == AuthChangeEvent.passwordRecovery) {
          if (mounted) {
            setState(() {
              _phase = _Phase.ready;
              _error = null;
            });
          }
        } else if (event == AuthChangeEvent.signedOut) {
          // Server-side signed us out (e.g. session expired).
          // Show the error state.
          if (mounted) {
            setState(() {
              _phase = _Phase.error;
              _error = 'recovery.session_expired'.tr();
            });
          }
        }
      });
    } catch (e) {
      // Supabase not initialized (anonymous dev mode, test
      // environment, or a deep-link race). Show error.
      if (mounted) {
        setState(() {
          _phase = _Phase.error;
          _error = 'recovery.supabase_not_initialized'.tr();
        });
      }
      return;
    }

    // Give the SDK a few seconds to deliver passwordRecovery.
    // If it doesn't, the link is probably invalid or expired.
    Future.delayed(const Duration(seconds: 8), () {
      if (!mounted) return;
      if (_phase == _Phase.verifying) {
        setState(() {
          _phase = _Phase.error;
          _error = 'recovery.link_expired'.tr();
        });
      }
    });
  }

  Future<void> _submit() async {
    final pw = _passwordController.text;
    final confirm = _confirmController.text;
    if (pw.length < 8) {
      setState(() => _error = 'recovery.password_too_short'.tr());
      return;
    }
    if (pw != confirm) {
      setState(() => _error = 'recovery.passwords_dont_match'.tr());
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await Supabase.instance.client.auth.updateUser(
        UserAttributes(password: pw),
      );
      if (mounted) {
        // The session is already valid (we updated the password
        // *while* signed in via the recovery session). Land on
        // the dashboard. The router's redirect will let us
        // through.
        context.go('/dashboard');
      }
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
    return Scaffold(
      appBar: AppBar(
        title: Text('recovery.title'.tr()),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => context.go('/login'),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: switch (_phase) {
            _Phase.verifying => _VerifyingView(
              message: 'recovery.verifying'.tr(),
            ),
            _Phase.ready => _ReadyForm(
              passwordController: _passwordController,
              confirmController: _confirmController,
              showPassword: _showPassword,
              onToggleShow: () =>
                  setState(() => _showPassword = !_showPassword),
              obscureConfirm: _obscureConfirm,
              onToggleConfirm: () =>
                  setState(() => _obscureConfirm = !_obscureConfirm),
              busy: _busy,
              onSubmit: _submit,
              error: _error,
            ),
            _Phase.error => _ErrorView(
              error: _error ?? 'recovery.invalid_link'.tr(),
              onBackToLogin: () => context.go('/login'),
              onTryAgain: () {
                setState(() {
                  _phase = _Phase.verifying;
                  _error = null;
                });
                _init();
              },
            ),
          },
        ),
      ),
    );
  }
}

class _VerifyingView extends StatelessWidget {
  const _VerifyingView({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const SizedBox(height: 64),
        const CircularProgressIndicator(),
        const SizedBox(height: 24),
        Text(message, textAlign: TextAlign.center),
      ],
    );
  }
}

class _ReadyForm extends StatelessWidget {
  const _ReadyForm({
    required this.passwordController,
    required this.confirmController,
    required this.showPassword,
    required this.onToggleShow,
    required this.obscureConfirm,
    required this.onToggleConfirm,
    required this.busy,
    required this.onSubmit,
    required this.error,
  });

  final TextEditingController passwordController;
  final TextEditingController confirmController;
  final bool showPassword;
  final VoidCallback onToggleShow;
  final bool obscureConfirm;
  final VoidCallback onToggleConfirm;
  final bool busy;
  final VoidCallback onSubmit;
  final String? error;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 24),
        Icon(Icons.lock_reset, size: 64, color: theme.colorScheme.primary),
        const SizedBox(height: 24),
        Text(
          'recovery.heading'.tr(),
          style: theme.textTheme.headlineSmall,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Text(
          'recovery.subtitle'.tr(),
          style: theme.textTheme.bodyMedium?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 32),
        TextField(
          controller: passwordController,
          obscureText: !showPassword,
          autocorrect: false,
          textCapitalization: TextCapitalization.none,
          decoration: InputDecoration(
            labelText: 'recovery.new_password'.tr(),
            helperText: 'recovery.password_hint'.tr(),
            prefixIcon: const Icon(Icons.lock),
            suffixIcon: IconButton(
              icon: Icon(
                showPassword ? Icons.visibility_off : Icons.visibility,
              ),
              onPressed: onToggleShow,
            ),
            border: const OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 16),
        TextField(
          controller: confirmController,
          obscureText: obscureConfirm,
          autocorrect: false,
          textCapitalization: TextCapitalization.none,
          decoration: InputDecoration(
            labelText: 'recovery.confirm_password'.tr(),
            prefixIcon: const Icon(Icons.lock_outline),
            suffixIcon: IconButton(
              icon: Icon(
                obscureConfirm ? Icons.visibility_off : Icons.visibility,
              ),
              onPressed: onToggleConfirm,
            ),
            border: const OutlineInputBorder(),
          ),
        ),
        if (error != null) ...[
          const SizedBox(height: 16),
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
                    error!,
                    style: TextStyle(color: theme.colorScheme.onErrorContainer),
                  ),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 24),
        FilledButton(
          onPressed: busy ? null : onSubmit,
          child: busy
              ? const SizedBox(
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : Text('recovery.update_password'.tr()),
        ),
      ],
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({
    required this.error,
    required this.onBackToLogin,
    required this.onTryAgain,
  });

  final String error;
  final VoidCallback onBackToLogin;
  final VoidCallback onTryAgain;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const SizedBox(height: 64),
        Icon(Icons.link_off, size: 64, color: theme.colorScheme.error),
        const SizedBox(height: 24),
        Text(
          'recovery.invalid_link'.tr(),
          style: theme.textTheme.headlineSmall,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Text(
          error,
          style: theme.textTheme.bodyMedium?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 32),
        FilledButton.icon(
          onPressed: onBackToLogin,
          icon: const Icon(Icons.login),
          label: Text('recovery.back_to_login'.tr()),
        ),
        const SizedBox(height: 8),
        TextButton(
          onPressed: onTryAgain,
          child: Text('recovery.try_again'.tr()),
        ),
      ],
    );
  }
}
