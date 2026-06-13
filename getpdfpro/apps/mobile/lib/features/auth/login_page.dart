import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:easy_localization/easy_localization.dart';

import '../../core/deep_links.dart';

/// Sign-in page.
///
/// We support two flows:
///   1. Cold start (no `returnTo`) — land on the dashboard after auth.
///   2. Gated tap (e.g. tapping AI Summarize while anonymous) — the
///      dashboard passes `?returnTo=/tools/summarize` so we drop the
///      user back on the tool they wanted, not the dashboard.
///
/// For OAuth (Google) we use a deep-link callback `getpdfpro://login-callback`.
/// The platform must register that scheme (see pubspec.yaml > platform
/// configs and the README). For email magic-link we use the same scheme.
class LoginPage extends StatefulWidget {
  const LoginPage({super.key, this.returnTo});

  /// Where to navigate after a successful sign-in. If null, go to
  /// `/dashboard`. We only accept paths that start with `/` and look
  /// like one of our own routes — never an absolute URL — to prevent
  /// open-redirect to attacker-controlled domains.
  final String? returnTo;

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  /// Resolves where to navigate after a successful sign-in.
  /// Falls back to `/dashboard` if `returnTo` is missing or unsafe.
  String _landing() {
    final rt = widget.returnTo;
    if (rt == null) return '/dashboard';
    if (!rt.startsWith('/')) return '/dashboard';
    if (rt.startsWith('//')) return '/dashboard';
    return rt;
  }

  Future<void> _signInWithPassword() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await Supabase.instance.client.auth.signInWithPassword(
        email: _emailController.text.trim(),
        password: _passwordController.text,
      );
      if (mounted) context.go(_landing());
    } on AuthException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _signInWithGoogle() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await Supabase.instance.client.auth.signInWithOAuth(
        OAuthProvider.google,
        redirectTo: DeepLinkConfig.loginCallback,
      );
      // OAuth is async via the system browser — we'll pick up the
      // session via onAuthStateChange in the router and re-route.
    } on AuthException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _signInWithGithub() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await Supabase.instance.client.auth.signInWithOAuth(
        OAuthProvider.github,
        redirectTo: DeepLinkConfig.loginCallback,
      );
    } on AuthException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _sendMagicLink() async {
    if (_emailController.text.isEmpty) {
      setState(() => _error = 'Enter your email first');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await Supabase.instance.client.auth.signInWithOtp(
        email: _emailController.text.trim(),
        emailRedirectTo: DeepLinkConfig.loginCallback,
      );
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('auth.magic_link_sent'.tr())));
      }
    } on AuthException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Forgot-password flow. We open a small dialog asking for the
  /// user's email (defaulting to whatever they typed in the email
  /// field, if any) and then call `resetPasswordForEmail` with the
  /// `getpdfpro://reset-password` deep-link redirect.
  ///
  /// IMPORTANT: The Supabase dashboard must allowlist
  /// `getpdfpro://**` under Authentication → URL Configuration →
  /// Redirect URLs. Without that, the verify endpoint falls back
  /// to the Site URL and the user lands on a 404 page instead of
  /// our app. See `platform_setup/README.md` for the exact steps.
  Future<void> _forgotPassword() async {
    final email = await showDialog<String>(
      context: context,
      builder: (ctx) =>
          _ForgotPasswordDialog(initialEmail: _emailController.text.trim()),
    );
    if (email == null || email.isEmpty || !mounted) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await Supabase.instance.client.auth.resetPasswordForEmail(
        email,
        redirectTo: DeepLinkConfig.resetPasswordCallback,
      );
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('login.reset_email_sent'.tr())));
      }
    } on AuthException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text('login.title'.tr())),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (widget.returnTo != null) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: theme.colorScheme.primaryContainer.withValues(
                      alpha: 0.3,
                    ),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.lock_outline, size: 18),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'errors.auth_required'.tr(),
                          style: theme.textTheme.bodySmall,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],
              TextField(
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                autocorrect: false,
                textCapitalization: TextCapitalization.none,
                decoration: InputDecoration(
                  labelText: 'login.email'.tr(),
                  prefixIcon: const Icon(Icons.email),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _passwordController,
                obscureText: true,
                decoration: InputDecoration(
                  labelText: 'login.password'.tr(),
                  prefixIcon: const Icon(Icons.lock),
                ),
              ),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: _loading ? null : _forgotPassword,
                  child: Text('login.forgot_password'.tr()),
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: TextStyle(color: theme.colorScheme.error)),
              ],
              const SizedBox(height: 24),
              FilledButton(
                onPressed: _loading ? null : _signInWithPassword,
                child: _loading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text('login.sign_in'.tr()),
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: _loading ? null : _sendMagicLink,
                child: Text('login.send_magic_link'.tr()),
              ),
              const SizedBox(height: 16),
              const Divider(),
              const SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: _loading ? null : _signInWithGoogle,
                icon: const Icon(Icons.login),
                label: Text('login.sign_in_with_google'.tr()),
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: _loading ? null : _signInWithGithub,
                icon: const Icon(Icons.code),
                label: Text('login.sign_in_with_github'.tr()),
              ),
              const SizedBox(height: 16),
              TextButton(
                onPressed: () => context.push('/signup'),
                child: Text('login.no_account'.tr()),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Modal dialog that asks the user for the email address to send
/// a password-recovery link to. Returns the entered email on
/// submit, or null if the user cancelled.
class _ForgotPasswordDialog extends StatefulWidget {
  const _ForgotPasswordDialog({required this.initialEmail});

  final String initialEmail;

  @override
  State<_ForgotPasswordDialog> createState() => _ForgotPasswordDialogState();
}

class _ForgotPasswordDialogState extends State<_ForgotPasswordDialog> {
  late final TextEditingController _controller = TextEditingController(
    text: widget.initialEmail,
  );

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text('login.forgot_password_title'.tr()),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'login.forgot_password_body'.tr(),
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
          child: Text('login.send_reset_link'.tr()),
        ),
      ],
    );
  }
}
