import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/foundation.dart';

/// Deep-link scheme registration. Centralized so that the same
/// string is used for:
///   - iOS Info.plist `CFBundleURLSchemes`
///   - Android `AndroidManifest.xml` `<data android:scheme="..."/>`
///   - Supabase `redirectTo` for OAuth + magic-link + password reset
///   - The `app_links` package's incoming-URL listener
///
/// If you change the scheme here, you must change it in BOTH
/// platform manifests. The `platform_setup/` directory contains
/// reference files to make the change findable.
class DeepLinkConfig {
  /// The custom URL scheme used by Supabase auth and the in-app
  /// link system. iOS and Android both register this.
  ///
  /// MUST stay in sync with:
  ///   - ios/Runner/Info.plist (CFBundleURLSchemes)
  ///   - android/app/src/main/AndroidManifest.xml (<data android:scheme=.../>)
  static const String scheme = 'getpdfpro';

  /// The host component of the OAuth/magic-link redirect. When
  /// the user finishes OAuth in the browser, they're sent to
  /// `getpdfpro://login-callback#access_token=...`.
  static const String loginCallbackHost = 'login-callback';

  /// The host component of the password-recovery redirect. When the
  /// user taps the email link, they're sent to
  /// `getpdfpro://reset-password?code=...` (the `code` is appended
  /// by Supabase's verify endpoint when this scheme is on the
  /// Redirect URLs allowlist — see `platform_setup/README.md`).
  static const String resetPasswordHost = 'reset-password';

  /// The host component of the email-verification redirect. When
  /// the user clicks the verification link in the email sent
  /// after `signUp`, they're sent to
  /// `getpdfpro://confirm-email?code=...`.
  static const String confirmEmailHost = 'confirm-email';

  /// Convenience: the exact `redirectTo` value passed to every
  /// Supabase `signInWith*` call. Equal to
  /// `$scheme://$loginCallbackHost`.
  static const String loginCallback = '$scheme://$loginCallbackHost';

  /// Convenience: the exact `redirectTo` value passed to
  /// `resetPasswordForEmail`. Equal to
  /// `$scheme://$resetPasswordHost`.
  static const String resetPasswordCallback = '$scheme://$resetPasswordHost';

  /// Convenience: the exact `emailRedirectTo` value passed to
  /// `signUp` for email-verification. Equal to
  /// `$scheme://$confirmEmailHost`.
  static const String confirmEmailCallback = '$scheme://$confirmEmailHost';

  /// Universal Links host — when App Links is verified on Android
  /// (or Universal Links is set up on iOS via the
  /// apple-app-site-association file), HTTPS links to this host
  /// will open the app directly.
  static const String universalLinkHost = 'app.getpdfpro.com';
}

/// A typed deep link the app has resolved from a raw URL. The
/// router and other listeners switch on `kind` instead of pattern-
/// matching URL strings.
sealed class DeepLinkAction {
  const DeepLinkAction();
}

/// Supabase sent us an OAuth or magic-link callback. The session
/// has typically already been exchanged by the time this fires —
/// we just need to navigate the user to the right place.
class LoginCallbackAction extends DeepLinkAction {
  const LoginCallbackAction({
    this.accessToken,
    this.refreshToken,
    this.error,
    this.errorDescription,
  });

  /// Parsed access token, if present in the URL fragment. Most
  /// modern Supabase SDKs return the session via the SDK's own
  /// deep-link listener, so this may be null even on success.
  final String? accessToken;
  final String? refreshToken;

  /// Error from the OAuth/magic-link flow, if any. The router
  /// shows these in a snackbar and lands the user on /login.
  final String? error;
  final String? errorDescription;

  bool get isError => error != null;
}

/// User clicked a password-reset link. We have an auth code in the
/// URL; Supabase will exchange it for a session when we call
/// `verifyOTP` or `exchangeCodeForSession`.
class PasswordRecoveryAction extends DeepLinkAction {
  const PasswordRecoveryAction({required this.code});

  /// The auth code Supabase sent. Single-use.
  final String code;
}

/// User clicked the email-verification link sent after `signUp`.
/// The SDK will exchange the code for a verified session
/// automatically. We just route to the welcome page.
class ConfirmEmailAction extends DeepLinkAction {
  const ConfirmEmailAction({this.code});

  /// The auth code Supabase sent, if present. The SDK may have
  /// already exchanged it before our parser sees the URL, in
  /// which case this is null. Either way, the
  /// `AuthChangeEvent.emailVerified` event is the source of
  /// truth — the code here is just for diagnostics.
  final String? code;
}

/// Catch-all for deep links we don't recognize. Useful for
/// future-proofing and for diagnosing link-handler bugs.
class UnknownDeepLinkAction extends DeepLinkAction {
  const UnknownDeepLinkAction(this.url);
  final Uri url;
}

/// Subscribes to incoming deep links and resolves them to typed
/// [DeepLinkAction]s. Singleton — call [DeepLinkHandler.instance]
/// from anywhere.
///
/// Lifecycle:
///   - [initialize] is called once from `main()` after Supabase is
///     up. It registers the platform channel listener and replays
///     any pending URL (Android delivers the initial intent URL
///     on first launch, iOS delivers it via [getInitialLink]).
///   - [actions] is a broadcast stream. The router (or any other
///     listener) subscribes and acts on each event.
class DeepLinkHandler {
  DeepLinkHandler._();
  static final DeepLinkHandler instance = DeepLinkHandler._();

  final AppLinks _appLinks = AppLinks();
  final _controller = StreamController<DeepLinkAction>.broadcast();

  /// Subscribers get one event per incoming deep link. The
  /// stream is broadcast so multiple listeners (router, analytics,
  /// etc.) can observe.
  Stream<DeepLinkAction> get actions => _controller.stream;

  bool _initialized = false;

  /// Wire up the platform channel and replay the initial link (if
  /// the app was cold-started by tapping one). Safe to call
  /// multiple times — the second call is a no-op.
  Future<void> initialize() async {
    if (_initialized) return;
    _initialized = true;
    try {
      // First, replay the link that started the app (if any).
      final initial = await _appLinks.getInitialLink();
      if (initial != null) {
        _controller.add(_parse(initial));
      }
      // Then subscribe to subsequent links (warm start, share sheet,
      // password-reset email tap, etc.).
      _appLinks.uriLinkStream.listen(
        (uri) => _controller.add(_parse(uri)),
        onError: (Object e) {
          debugPrint('DeepLinkHandler: uriLinkStream error: $e');
        },
      );
    } catch (e) {
      // app_links throws on platforms that don't support deep
      // linking (e.g. headless tests). Don't crash — just skip.
      debugPrint('DeepLinkHandler: initialize failed: $e');
    }
  }

  /// Resolve a raw URI into a typed action. Public for testing and
  /// for callers that get a URI from a non-platform source (e.g.
  /// QR codes, Share extensions).
  DeepLinkAction parse(Uri uri) => _parse(uri);

  DeepLinkAction _parse(Uri uri) {
    // Custom scheme: `getpdfro://login-callback#access_token=...`
    //                 `getpdfro://reset-password?code=...`
    //                 `getpdfro://confirm-email?code=...`
    if (uri.scheme == DeepLinkConfig.scheme) {
      switch (uri.host) {
        case DeepLinkConfig.loginCallbackHost:
          return _parseLoginCallback(uri);
        case DeepLinkConfig.resetPasswordHost:
          final code = uri.queryParameters['code'];
          if (code != null && code.isNotEmpty) {
            return PasswordRecoveryAction(code: code);
          }
          // No code? The Supabase allowlist is probably not
          // configured — the verify endpoint fell back to the
          // Site URL. Treat as a login callback (the SDK will
          // still try to interpret the URL as OAuth).
          return _parseLoginCallback(uri);
        case DeepLinkConfig.confirmEmailHost:
          return ConfirmEmailAction(code: uri.queryParameters['code']);
        default:
          return UnknownDeepLinkAction(uri);
      }
    }

    // HTTPS Universal Link: `https://app.getpdfpro.com/reset-password?code=...`
    //                       `https://app.getpdfpro.com/confirm-email?code=...`
    if (uri.scheme == 'https' && uri.host == DeepLinkConfig.universalLinkHost) {
      if (uri.path.startsWith('/auth/')) {
        // /auth/callback style — same as login-callback for our purposes.
        return _parseLoginCallback(uri);
      }
      if (uri.path.startsWith('/reset-password')) {
        final code = uri.queryParameters['code'];
        if (code != null && code.isNotEmpty) {
          return PasswordRecoveryAction(code: code);
        }
      }
      if (uri.path.startsWith('/confirm-email') ||
          uri.path.startsWith('/verify-email')) {
        return ConfirmEmailAction(code: uri.queryParameters['code']);
      }
      return UnknownDeepLinkAction(uri);
    }

    return UnknownDeepLinkAction(uri);
  }

  DeepLinkAction _parseLoginCallback(Uri uri) {
    // Supabase puts the access token in the URL fragment
    // (`#access_token=...`), not the query string. Fragments
    // are NOT sent to the server, so this is safe for tokens.
    final fragment = uri.fragment;
    final fragmentParams = _parseFragment(fragment);
    final queryParams = uri.queryParameters;
    return LoginCallbackAction(
      accessToken: fragmentParams['access_token'],
      refreshToken: fragmentParams['refresh_token'],
      error: queryParams['error'] ?? fragmentParams['error'],
      errorDescription:
          queryParams['error_description'] ??
          fragmentParams['error_description'],
    );
  }

  Map<String, String> _parseFragment(String fragment) {
    if (fragment.isEmpty) return const {};
    return Uri.splitQueryString(fragment);
  }
}
