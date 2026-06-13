import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../features/auth/confirm_email_page.dart';
import '../../features/auth/login_page.dart';
import '../../features/auth/recovery_page.dart';
import '../../features/auth/signup_page.dart';
import '../../features/dashboard/dashboard_page.dart';
import '../../features/onboarding/welcome_page.dart';
import '../../features/settings/settings_page.dart';
import '../../features/tools/compress_page.dart';
import '../../features/tools/merge_page.dart';
import '../../features/tools/compare_page.dart';
import '../../features/tools/organize_page.dart';
import '../../features/tools/pdf_to_image_page.dart';
import '../../features/tools/protect_page.dart';
import '../../features/tools/simple_tool_pages.dart';
import '../../features/tools/split_page.dart';
import '../../features/tools/text_input_tool_page.dart';
import '../../features/tools/tool_placeholder.dart';
import '../../core/deep_links.dart';
import '../../core/tool_registry.dart';

/// Auth-aware router for the GetPDFPro mobile app.
///
/// Route map:
///   /                → redirect to /welcome (cold start)
///   /welcome         → public onboarding
///   /login           → public, with optional `?returnTo=...`
///   /signup          → public
///   /dashboard       → auth-gated (after sign-in the user lands here)
///   /settings        → public — sign-in state shown inside the page
///   /tools/<id>      → public — works for anonymous users (matches the
///                       web app, which lets anon users run most tools).
///                       Tools that need auth (`requiresSignIn: true` in
///                       the registry) are gated at the call site, not
///                       the route, so the user gets a friendly snackbar.
///
/// Unknown tool IDs land on a "Coming soon" placeholder instead of a
/// 404 — that way the dashboard never feels broken even when only a
/// few tools are implemented.
///
/// The router also subscribes to [DeepLinkHandler.actions] for
/// incoming OAuth / magic-link / password-reset callbacks. On a
/// `LoginCallbackAction` we navigate the user to /dashboard (or
/// surface an error snackbar if the callback carried an error).
/// On a `PasswordRecoveryAction` we send the user to a recovery
/// page (TODO: build the page; for now the link is logged and the
/// user stays where they are — Supabase's `verifyOTP` flow can
/// also be triggered from the recovery page once it exists).
final appRouterProvider = Provider<GoRouter>((ref) {
  final refresh = _RouterRefreshListenable();
  final router = _buildRouter(refresh);

  // After the router is built, hand it to the refresh list so
  // the deep-link listener can call router.go() directly. We
  // set this in a microtask so any deep-link events that fired
  // between main()'s DeepLinkHandler.initialize() and now have
  // already landed on the stream (we don't want to race a `go`
  // call against the initial route).
  scheduleMicrotask(() {
    refresh.router = router;

    // Subscribe once to deep-link actions. The router mutates its
    // own location based on the action type. The subscription is
    // fire-and-forget and self-cancels if the router is ever
    // disposed (it isn't, in practice, since this provider lives
    // for the lifetime of the app).
    DeepLinkHandler.instance.actions.listen((action) {
      switch (action) {
        case LoginCallbackAction():
          if (action.isError) {
            debugPrint(
              'Login callback error: ${action.error} '
              '${action.errorDescription ?? ''}',
            );
            // The router refresh will pick up the new auth state
            // and send the user to /login automatically.
          } else {
            // Session should already be set by Supabase's own
            // deep-link listener. Just refresh the router and
            // let its redirect logic put the user on /dashboard.
            debugPrint('Login callback received; refreshing router');
          }
          refresh.notifyAndRoute('/dashboard');
          break;
        case PasswordRecoveryAction():
          debugPrint(
            'Password recovery link received; code length '
            '${action.code.length}',
          );
          // The Supabase SDK's _handleDeeplink() will already
          // have started the PKCE exchange. We just navigate to
          // the recovery page. The page itself checks for an
          // active session AND subscribes to onAuthStateChange
          // for the `passwordRecovery` event.
          refresh.notifyAndRoute('/auth/recovery?code=${action.code}');
          break;
        case ConfirmEmailAction():
          debugPrint(
            'Email verification link received; code length '
            '${action.code?.length ?? 0}',
          );
          // Same pattern as recovery: SDK has started the
          // exchange. Navigate to the confirmation page; it
          // listens for `emailVerified` on its own.
          final codeParam = action.code != null
              ? '?code=${Uri.encodeComponent(action.code!)}'
              : '';
          refresh.notifyAndRoute('/auth/confirm$codeParam');
          break;
        case UnknownDeepLinkAction():
          debugPrint('Unknown deep link: ${action.url}');
          break;
      }
    });

    // Belt-and-suspenders: even if the deep-link listener somehow
    // misses a `getpdfpro://reset-password` URL, the SDK's
    // onAuthStateChange stream will still fire `passwordRecovery`
    // when the PKCE exchange completes. Listen for that too.
    // See supabase discussion #43284.
    try {
      Supabase.instance.client.auth.onAuthStateChange.listen((data) {
        if (data.event == AuthChangeEvent.passwordRecovery) {
          // The session is now valid (recovery type). Only
          // navigate if we're not already on the recovery page
          // (avoid the redundant navigation race).
          final current =
              refresh.router?.routerDelegate.currentConfiguration.uri.path;
          if (current != '/auth/recovery') {
            debugPrint(
              'AuthStateChange.passwordRecovery — routing to /auth/recovery',
            );
            refresh.notifyAndRoute('/auth/recovery');
          }
        } else if (data.event == AuthChangeEvent.signedIn) {
          // Email-confirmation flow: Supabase doesn't expose a
          // dedicated `emailVerified` event. Instead, the SDK
          // exchanges the PKCE code and fires `signedIn` (or
          // `initialSession` on cold start). The session's
          // `emailConfirmedAt` is set server-side as part of
          // the exchange. If we just landed on /auth/confirm
          // (i.e. we came from an email-verification deep link
          // and the user is now signed in), this is the moment
          // to show the success state.
          final current =
              refresh.router?.routerDelegate.currentConfiguration.uri.path;
          if (current == '/auth/confirm' &&
              data.session?.user.emailConfirmedAt != null) {
            debugPrint(
              'AuthStateChange.signedIn on /auth/confirm — '
              'treating as email verification success',
            );
            // The page is already mounted and listening for
            // emailVerified; it will see currentSession itself.
            // No navigation needed; the page flips to success
            // when it sees the session + emailConfirmedAt.
          }
        }
      });
    } catch (_) {
      // Supabase not initialized in anonymous dev mode.
    }
  });

  return router;
});

GoRouter _buildRouter(_RouterRefreshListenable refresh) {
  return GoRouter(
    initialLocation: '/',
    refreshListenable: refresh,
    redirect: (context, state) {
      final session = Supabase.instance.client.auth.currentSession;
      final loc = state.matchedLocation;
      final isAuthRoute = loc == '/login' || loc == '/signup';

      if (session != null && isAuthRoute) return '/dashboard';
      if (session == null && loc == '/dashboard') {
        // Keep returnTo so we land back on the dashboard after sign-in.
        return '/login?returnTo=${Uri.encodeComponent('/dashboard')}';
      }
      // Don't redirect away from the recovery / confirm pages just
      // because the session is still warming up — those pages show
      // a loading state and the error state if the session never
      // materializes.
      // Everything else (tools, settings, welcome) is publicly accessible.
      return null;
    },
    routes: [
      GoRoute(path: '/', redirect: (_, __) => '/welcome'),
      GoRoute(path: '/welcome', builder: (_, __) => const WelcomePage()),
      GoRoute(
        path: '/login',
        builder: (context, state) {
          final returnTo = state.uri.queryParameters['returnTo'];
          return LoginPage(returnTo: returnTo);
        },
      ),
      GoRoute(path: '/signup', builder: (_, __) => const SignupPage()),
      GoRoute(
        path: '/auth/recovery',
        builder: (context, state) {
          final code = state.uri.queryParameters['code'];
          return RecoveryPage(code: code);
        },
      ),
      GoRoute(
        path: '/auth/confirm',
        builder: (context, state) {
          final code = state.uri.queryParameters['code'];
          return ConfirmEmailPage(code: code);
        },
      ),
      GoRoute(path: '/dashboard', builder: (_, __) => const DashboardPage()),
      GoRoute(path: '/settings', builder: (_, __) => const SettingsPage()),
      // Custom-UIX tool pages — each has its own state model
      // (file picker, multi-file, password, etc.) and can't be
      // expressed via the StandardToolPage builder.
      GoRoute(path: '/tools/merge', builder: (_, __) => const MergePage()),
      GoRoute(path: '/tools/split', builder: (_, __) => const SplitPage()),
      GoRoute(
        path: '/tools/compress',
        builder: (_, __) => const CompressPage(),
      ),
      GoRoute(
        path: '/tools/pdf-to-image',
        builder: (_, __) => const PdfToImagePage(),
      ),
      GoRoute(path: '/tools/protect', builder: (_, __) => const ProtectPage()),
      GoRoute(
        path: '/tools/organize',
        builder: (_, __) => const OrganizePage(),
      ),
      // Compare PDFs — two-file picker, posts to
      // /api/v1/pdf/compare-download with file_a + file_b
      // multipart parts. Reads X-Cascade-Adapter response
      // header to pick the right renderer (Adobe vs local
      // PyMuPDF). See features/tools/compare_page.dart.
      GoRoute(
        path: '/tools/compare',
        builder: (_, __) => const ComparePage(),
      ),
      // AI / accessibility tools — text-input UX (no file
      // picker; the user types or pastes content).
      GoRoute(
        path: '/tools/summarize',
        builder: (_, __) => const TextInputToolPage(
          title: 'AI Summarize',
          subtitle:
              'Get a concise summary of a long block of text using Gemini.',
          endpoint: '/api/v1/pdf/summarize-download',
          responseKey: 'summary',
          preSubmitHint: 'Paste or type up to ~10,000 words to summarize.',
        ),
      ),
      GoRoute(
        path: '/tools/translate',
        builder: (_, __) => const TextInputToolPage(
          title: 'AI Translate',
          subtitle: 'Translate text to one of 12+ languages using Gemini.',
          endpoint: '/api/v1/pdf/translate-download',
          responseKey: 'translation',
          preSubmitHint:
              'Text to translate. Server picks target language from Accept-Language.',
        ),
      ),
      GoRoute(
        path: '/tools/read-aloud',
        builder: (_, __) => const TextInputToolPage(
          title: 'Read Aloud',
          subtitle:
              'Text-to-speech via the device\'s built-in TTS engine. Free, offline, no upload.',
          endpoint: '/api/v1/pdf/read-aloud',
          responseKey: 'text',
          preSubmitHint: 'Paste text; we\'ll speak it.',
        ),
      ),
      GoRoute(
        path: '/tools/dictate',
        builder: (_, __) => const TextInputToolPage(
          title: 'Dictate',
          subtitle:
              'Speech-to-text. Tap the mic, speak, see your words transcribed on-device.',
          endpoint: '/api/v1/pdf/dictate',
          responseKey: 'text',
          preSubmitHint: 'Hold the mic button to dictate.',
        ),
      ),
      // Standardized tool pages — all share the same
      // "file-picker + form-fields + submit + save" UX via
      // kSimpleToolPages / buildSimpleToolPage(). Adding a
      // new tool = add a ToolPageSpec to the map; the helper
      // below generates the GoRoute for it.
      for (final toolId in kSimpleToolPages.keys)
        GoRoute(
          path: '/tools/$toolId',
          builder: (_, __) =>
              buildSimpleToolPage(toolId) ?? const SizedBox.shrink(),
        ),
      // Catch-all for any other /tools/<id> — see redirect below.
      // Tools that have a native page (registered as a GoRoute
      // above OR in kSimpleToolPages) never hit this branch. The
      // `placeholder` flag on Tool is a hint for future tools
      // that should render the "Coming soon" page.
      GoRoute(
        path: '/tools/:toolId',
        builder: (context, state) {
          final id = state.pathParameters['toolId'] ?? '';
          final tool = ToolRegistry.byId(id);
          if (tool == null) {
            return const ToolPlaceholderPage(
              toolId: 'unknown',
              toolTitle: 'Unknown tool',
            );
          }
          if (tool.placeholder) {
            return ToolPlaceholderPage(
              toolId: tool.id,
              toolTitle: tool.titleKey,
              toolDescription: tool.descriptionKey,
              toolIcon: tool.icon,
              webPath: tool.webPath,
            );
          }
          return ToolPlaceholderPage(
            toolId: tool.id,
            toolTitle: tool.titleKey,
            toolDescription: tool.descriptionKey,
            toolIcon: tool.icon,
            webPath: tool.webPath,
          );
        },
      ),
    ],
  );
}

/// Bridges Supabase's auth state stream + the deep-link stream to
/// go_router's `refreshListenable`. Notifies on:
///   - Sign-in / sign-out / token refresh (Supabase)
///   - Login callback (deep link)
class _RouterRefreshListenable extends ChangeNotifier {
  _RouterRefreshListenable() {
    try {
      Supabase.instance.client.auth.onAuthStateChange.listen((_) {
        notifyListeners();
      });
    } catch (_) {
      // Supabase not initialized in this dev build — silently no-op.
    }
  }

  /// The router sets this back-reference so the deep-link listener
  /// can navigate after calling `notifyListeners()`. Set by the
  /// app's `MaterialApp.router(routerConfig: ...)` callback.
  GoRouter? router;

  /// Notify listeners AND navigate the router to a target location.
  /// Use when a deep link is the trigger for a navigation — without
  /// the explicit `router.go()` the redirect logic would only fire
  /// on the next user-driven route change.
  void notifyAndRoute(String location) {
    notifyListeners();
    router?.go(location);
  }
}
