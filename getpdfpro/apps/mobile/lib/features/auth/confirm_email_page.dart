import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:easy_localization/easy_localization.dart';

import '../../core/deep_links.dart';

/// Email-verification confirmation page.
///
/// Flow (per Supabase's PKCE pattern):
///
///   1. User signs up via `Supabase.auth.signUp(email, password,
///      emailRedirectTo: getpdfpro://confirm-email)`. Supabase
///      sends a verification email with the recovery URL.
///   2. User taps the link. The OS opens our app via the
///      deep-link handler. The Supabase SDK's
///      `_handleDeeplink()` runs during `Supabase.initialize()`
///      and exchanges the PKCE code for a session automatically.
///      The account's `email_confirmed_at` is set server-side as
///      part of the exchange.
///   3. The SDK fires `AuthChangeEvent.emailVerified` on
///      `onAuthStateChange`. The router listens for this and
///      navigates us to `/auth/confirm`.
///   4. This page renders. We check for a session AND subscribe
///      to `onAuthStateChange` (the cold-start race condition fix).
///   5. We show a success screen — the user is verified and
///      signed in. They tap "Continue to dashboard" to land on
///      `/dashboard`.
///
/// Two error cases we handle:
///   (a) The verification link is invalid or expired.
///   (b) The user is on this page WITHOUT a session — they
///       probably opened the link in a browser, or they tapped it
///       before signing up.
///
/// In both cases we offer "Resend verification email" (requires
/// the user's email) and "Back to sign in".
class ConfirmEmailPage extends StatefulWidget {
  const ConfirmEmailPage({super.key, this.code});

  /// The PKCE code from the URL. Not used directly (the SDK does
  /// the exchange) but kept for diagnostics.
  final String? code;

  @override
  State<ConfirmEmailPage> createState() => _ConfirmEmailPageState();
}

enum _Phase { verifying, success, error }

class _ConfirmEmailPageState extends State<ConfirmEmailPage> {
  _Phase _phase = _Phase.verifying;
  String? _error;
  StreamSubscription<AuthState>? _authSub;

  @override
  void initState() {
    super.initState();
    _init();
  }

  @override
  void dispose() {
    _authSub?.cancel();
    super.dispose();
  }

  /// Two parallel checks: is the session already set (the SDK may
  /// have already processed the deep link before we got here), and
  /// listen for `signedIn` / `initialSession` events in case the
  /// SDK hasn't finished the PKCE exchange yet.
  ///
  /// Note: the modern Supabase SDK does not expose a dedicated
  /// `emailVerified` event. Confirmation is detected via the
  /// session's `emailConfirmedAt` timestamp.
  ///
  /// The whole body is wrapped in a try/catch so calling this
  /// page BEFORE `Supabase.initialize()` runs (e.g. in a test,
  /// or in a deep-link flow that races the app's own
  /// bootstrap) doesn't crash with a `_isInitialized`
  /// assertion. Instead we land on the friendly
  /// "supabase_not_initialized" error state.
  Future<void> _init() async {
    try {
      final session = Supabase.instance.client.auth.currentSession;
      if (session != null && session.user.emailConfirmedAt != null) {
        // We have a session AND the email is confirmed. Show
        // the success state. (An unconfirmed-email session
        // shouldn't happen via the deep-link route, but we
        // guard against it.)
        if (mounted) {
          setState(() {
            _phase = _Phase.success;
            _error = null;
          });
        }
        return;
      }

      // No session yet. Supabase's PKCE flow fires `signedIn`
      // (or `initialSession` on cold start) when the verification
      // link is processed — it does NOT expose a dedicated
      // `emailVerified` event. The session's `emailConfirmedAt`
      // is set server-side as part of the PKCE exchange, so we
      // use that as the success signal.
      _authSub = Supabase.instance.client.auth.onAuthStateChange.listen((data) {
        final event = data.event;
        if (event == AuthChangeEvent.signedIn ||
            event == AuthChangeEvent.initialSession) {
          // We just got a session. If the email is confirmed,
          // show the success state.
          final user = data.session?.user;
          if (user != null && user.emailConfirmedAt != null) {
            if (mounted) {
              setState(() {
                _phase = _Phase.success;
                _error = null;
              });
            }
          }
        } else if (event == AuthChangeEvent.signedOut) {
          if (mounted) {
            setState(() {
              _phase = _Phase.error;
              _error = 'confirm.session_expired'.tr();
            });
          }
        }
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _phase = _Phase.error;
          _error = 'confirm.supabase_not_initialized'.tr();
        });
      }
      return;
    }

    // 8-second timeout. If emailConfirmedAt is still null after
    // 8s, the link is probably invalid or expired.
    Future.delayed(const Duration(seconds: 8), () {
      if (!mounted) return;
      if (_phase == _Phase.verifying) {
        setState(() {
          _phase = _Phase.error;
          _error = 'confirm.link_expired'.tr();
        });
      }
    });
  }

  /// Resend the verification email. The user types their email in
  /// a dialog; we call `Supabase.auth.resend(type: OtpType.email,
  /// email: ...)`.
  Future<void> _resend() async {
    final email = await showDialog<String>(
      context: context,
      builder: (ctx) => _ResendDialog(),
    );
    if (email == null || email.isEmpty || !mounted) return;
    setState(() {
      _error = null;
    });
    try {
      await Supabase.instance.client.auth.resend(
        type: OtpType.email,
        email: email,
        emailRedirectTo: DeepLinkConfig.confirmEmailCallback,
      );
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('confirm.resend_sent'.tr())));
      }
    } on AuthException catch (e) {
      setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text('confirm.title'.tr()),
        leading: _phase == _Phase.error
            ? IconButton(
                icon: const Icon(Icons.close),
                onPressed: () => context.go('/login'),
              )
            : null,
        automaticallyImplyLeading: _phase == _Phase.error,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: switch (_phase) {
            _Phase.verifying => _VerifyingView(
              message: 'confirm.verifying'.tr(),
            ),
            _Phase.success => _SuccessView(
              onContinue: () => context.go('/dashboard'),
            ),
            _Phase.error => _ErrorView(
              error: _error ?? 'confirm.invalid_link'.tr(),
              onResend: _resend,
              onBackToLogin: () => context.go('/login'),
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

class _SuccessView extends StatelessWidget {
  const _SuccessView({required this.onContinue});
  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const SizedBox(height: 64),
        Container(
          width: 96,
          height: 96,
          decoration: BoxDecoration(
            color: theme.colorScheme.primaryContainer,
            shape: BoxShape.circle,
          ),
          child: Icon(
            Icons.mark_email_read,
            size: 56,
            color: theme.colorScheme.primary,
          ),
        ),
        const SizedBox(height: 32),
        Text(
          'confirm.success_heading'.tr(),
          style: theme.textTheme.headlineSmall,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 12),
        Text(
          'confirm.success_subtitle'.tr(),
          style: theme.textTheme.bodyMedium?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 48),
        FilledButton.icon(
          onPressed: onContinue,
          icon: const Icon(Icons.arrow_forward),
          label: Text('confirm.continue_to_dashboard'.tr()),
        ),
      ],
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({
    required this.error,
    required this.onResend,
    required this.onBackToLogin,
  });

  final String error;
  final VoidCallback onResend;
  final VoidCallback onBackToLogin;

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
          'confirm.invalid_link'.tr(),
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
          onPressed: onResend,
          icon: const Icon(Icons.send),
          label: Text('confirm.resend_verification'.tr()),
        ),
        const SizedBox(height: 8),
        TextButton(
          onPressed: onBackToLogin,
          child: Text('confirm.back_to_login'.tr()),
        ),
      ],
    );
  }
}

class _ResendDialog extends StatefulWidget {
  @override
  State<_ResendDialog> createState() => _ResendDialogState();
}

class _ResendDialogState extends State<_ResendDialog> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text('confirm.resend_title'.tr()),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'confirm.resend_body'.tr(),
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _controller,
            keyboardType: TextInputType.emailAddress,
            autocorrect: false,
            textCapitalization: TextCapitalization.none,
            decoration: InputDecoration(
              labelText: 'auth.email'.tr(),
              prefixIcon: const Icon(Icons.email),
              border: const OutlineInputBorder(),
            ),
            autofocus: true,
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text('common.cancel'.tr()),
        ),
        FilledButton(
          onPressed: () {
            final email = _controller.text.trim();
            if (email.isNotEmpty) {
              Navigator.of(context).pop(email);
            }
          },
          child: Text('confirm.send_again'.tr()),
        ),
      ],
    );
  }
}
