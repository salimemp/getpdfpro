import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:easy_localization/easy_localization.dart';

import '../../core/deep_links.dart';

/// Sign-up page.
///
/// Flow:
///   1. User enters name + email + password.
///   2. We call `Supabase.auth.signUp(...)` with
///      `emailRedirectTo: getpdfpro://confirm-email`.
///   3. Supabase creates the account (signed in, but with
///      `email_confirmed_at == null`) and sends a verification
///      email.
///   4. We show a "check your email" message. The user can tap
///      the link in the email — this opens our app via deep
///      link → router navigates to `/auth/confirm` → they tap
///      "Continue to dashboard".
///
/// We do NOT auto-navigate after signUp. Auto-navigation would
/// break the email-verification flow because the user would
/// be inside the app, then have to leave the app to check
/// their email, then come back. Better to keep them on the
/// signup-success screen with a clear "check your email" CTA
/// + a "resend" button + a "use a different email" button.
class SignupPage extends StatefulWidget {
  const SignupPage({super.key});

  @override
  State<SignupPage> createState() => _SignupPageState();
}

class _SignupPageState extends State<SignupPage> {
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _signUp() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text;
    final name = _nameController.text.trim();
    if (name.isEmpty) {
      setState(() => _error = 'signup.name_required'.tr());
      return;
    }
    if (email.isEmpty) {
      setState(
        () => _error =
            'auth.email'.tr() + ' ' + 'errors.empty_file'.tr().toLowerCase(),
      );
      return;
    }
    if (password.length < 8) {
      setState(() => _error = 'recovery.password_too_short'.tr());
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await Supabase.instance.client.auth.signUp(
        email: email,
        password: password,
        emailRedirectTo: DeepLinkConfig.confirmEmailCallback,
        data: {'full_name': name}, // stored in user_metadata
      );
      if (mounted) {
        // Replace the signup page with a "check your email" screen
        // so back-button doesn't drop the user back into the form.
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => _CheckYourEmailPage(email: email)),
        );
      }
    } on AuthException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text('signup.title'.tr())),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('signup.heading'.tr(), style: theme.textTheme.headlineSmall),
              const SizedBox(height: 8),
              Text(
                'signup.subtitle'.tr(),
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 24),
              TextField(
                controller: _nameController,
                textCapitalization: TextCapitalization.words,
                decoration: InputDecoration(
                  labelText: 'auth.name'.tr(),
                  prefixIcon: const Icon(Icons.person),
                  border: const OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                autocorrect: false,
                textCapitalization: TextCapitalization.none,
                decoration: InputDecoration(
                  labelText: 'auth.email'.tr(),
                  prefixIcon: const Icon(Icons.email),
                  border: const OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _passwordController,
                obscureText: _obscurePassword,
                autocorrect: false,
                textCapitalization: TextCapitalization.none,
                decoration: InputDecoration(
                  labelText: 'auth.password'.tr(),
                  helperText: 'recovery.password_hint'.tr(),
                  prefixIcon: const Icon(Icons.lock),
                  suffixIcon: IconButton(
                    icon: Icon(
                      _obscurePassword
                          ? Icons.visibility_off
                          : Icons.visibility,
                    ),
                    onPressed: () =>
                        setState(() => _obscurePassword = !_obscurePassword),
                  ),
                  border: const OutlineInputBorder(),
                ),
              ),
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
              ],
              const SizedBox(height: 24),
              FilledButton(
                onPressed: _loading ? null : _signUp,
                child: _loading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text('signup.create_account'.tr()),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    'signup.have_account'.tr(),
                    style: theme.textTheme.bodySmall,
                  ),
                  TextButton(
                    onPressed: () => context.go('/login'),
                    child: Text('common.sign_in'.tr()),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// "Check your email" screen shown after a successful signUp.
///
/// The user is currently signed in (Supabase creates a session
/// even before email confirmation), so they have access to the
/// dashboard. We don't auto-navigate because we want them to
/// read this screen — the natural next step is to leave the
/// app, check email, and tap the verification link.
class _CheckYourEmailPage extends StatelessWidget {
  const _CheckYourEmailPage({required this.email});
  final String email;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text('signup.check_email_title'.tr()),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => context.go('/login'),
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 32),
              Container(
                width: 96,
                height: 96,
                decoration: BoxDecoration(
                  color: theme.colorScheme.primaryContainer,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.mark_email_unread,
                  size: 56,
                  color: theme.colorScheme.primary,
                ),
              ),
              const SizedBox(height: 32),
              Text(
                'signup.check_email_heading'.tr(),
                style: theme.textTheme.headlineSmall,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              Text(
                'signup.check_email_body'.tr(namedArgs: {'email': email}),
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),
              FilledButton.icon(
                onPressed: () => context.go('/dashboard'),
                icon: const Icon(Icons.arrow_forward),
                label: Text('signup.skip_for_now'.tr()),
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: () => context.go('/login'),
                child: Text('signup.use_different_email'.tr()),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
