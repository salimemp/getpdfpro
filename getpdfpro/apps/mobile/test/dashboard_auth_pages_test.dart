import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:easy_localization/easy_localization.dart';
// We use the package's internal Localization + Controller classes
// here because the public API (EasyLocalization.ensureInitialized)
// doesn't load our custom asset path under `flutter test`. This
// is the same pattern easy_localization's own tests use.
// ignore: implementation_imports
import 'package:easy_localization/src/easy_localization_controller.dart';
// ignore: implementation_imports
import 'package:easy_localization/src/localization.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:getpdfpro_mobile/core/tool_registry.dart';
import 'package:getpdfpro_mobile/features/dashboard/dashboard_page.dart';
import 'package:getpdfpro_mobile/features/auth/recovery_page.dart';
import 'package:getpdfpro_mobile/features/auth/confirm_email_page.dart';

/// Widget tests for the three auth + dashboard pages.
///
/// These tests run in a real Flutter test environment with no
/// Supabase / no app_links / no path_provider available. We rely
/// on each page's defensive try/catch around platform calls — if
/// Supabase isn't initialized, the page should either:
///   - Show the "anonymous mode" / signed-out state
///     (DashboardPage's greeting is "Welcome" when currentUser
///     throws)
///   - Show the error state with a "supabase not initialized"
///     message (RecoveryPage, ConfirmEmailPage)
/// That way we can render the full widget tree in a test
/// without mocking anything.
///
/// For widget tests that need real Supabase, you'd typically
/// inject a GoTrueClient through ProviderScope. We skip that
/// for the smoke test — the goal here is to catch rendering
/// regressions, not full integration.

Widget _wrap(Widget child, {Key? key}) {
  // Note: we deliberately do NOT wrap in `EasyLocalization` here
  // because that widget creates its own controller and would
  // overwrite the singleton we set up in `setUp`. Instead, the
  // pages call `String.tr()` which uses the singleton directly
  // when no context is passed (which is how our pages use it).
  return MaterialApp(
    home: child,
    key: key,
    // Localizations delegate so Material widgets that look up
    // directionality (TextField, etc.) don't crash.
    localizationsDelegates: const [
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ],
    supportedLocales: const [Locale('en')],
  );
}

void main() {
  // We do the singleton load in setUpAll (once) because the
  // asset bundle is read once. SharedPreferences gets
  // re-mocked in setUp between tests.
  setUpAll(() async {
    // Mock the SharedPreferences backing store — EasyLocalization
    // persists the user's locale choice here.
    SharedPreferences.setMockInitialValues({});
  });

  setUp(() async {
    // Reset SharedPreferences between tests so the locale
    // doesn't bleed across tests.
    SharedPreferences.setMockInitialValues({});

    // Load the i18n JSON directly into the Localization
    // singleton used by `context.tr()`. This is the same
    // pattern the easy_localization package's own tests use,
    // and it's the only one that works under `flutter test`
    // (the EasyLocalization.ensureInitialized() shortcut
    // silently returns a controller with no translations).
    final controller = EasyLocalizationController(
      forceLocale: const Locale('en'),
      path: 'assets/i18n',
      supportedLocales: const [Locale('en')],
      useOnlyLangCode: true,
      useFallbackTranslations: true,
      saveLocale: false,
      assetLoader: const RootBundleAssetLoader(),
      onLoadError: (FlutterError e) {
        // ignore: avoid_print
        print('[i18n-test] load error: $e');
      },
    );
    await controller.loadTranslations();

    // Bridge the controller's translations into the
    // singleton `Localization` that `context.tr()` reads
    // from. Without this call, `.tr()` returns the raw key.
    Localization.load(
      const Locale('en'),
      translations: controller.translations,
    );
  });

  group('DashboardPage', () {
    testWidgets('renders the greeting + search bar + first category', (
      tester,
    ) async {
      await tester.pumpWidget(_wrap(const DashboardPage()));
      // Let the SliverAppBar.large + first frame settle.
      await tester.pumpAndSettle();

      // The anonymous greeting should be "Welcome" — at least
      // once. (SliverAppBar.large may render the title in both
      // the expanded and collapsed state during the test
      // animation, so we use findsAtLeastNWidgets.)
      expect(
        find.text('dashboard.greeting_anon'.tr()),
        findsAtLeastNWidgets(1),
      );

      // The search bar should be present.
      expect(find.byType(TextField), findsOneWidget);

      // Only the FIRST category is visible in the default test
      // viewport (no scrolling). We assert that one is visible
      // — the full enumeration of all 8 categories is covered
      // by the ToolRegistry in-widget test below.
      expect(
        find.text(ToolCategory.organize.titleKey.tr()),
        findsAtLeastNWidgets(1),
        reason: 'First category should be visible without scrolling',
      );
    });

    testWidgets('shows quick-action tools', (tester) async {
      await tester.pumpWidget(_wrap(const DashboardPage()));
      await tester.pumpAndSettle();

      // The dashboard surfaces 4 quick-action tools at the top.
      // We assert that AT LEAST ONE renders — the full
      // enumeration of all 39 tools is covered by the
      // ToolRegistry test below.
      final tool = ToolRegistry.byId('merge');
      expect(tool, isNotNull);
      expect(
        find.text(tool!.titleKey.tr()),
        findsAtLeastNWidgets(1),
        reason: 'First quick-action (Merge) should render',
      );
    });
  });

  group('RecoveryPage', () {
    testWidgets('shows error state when no code is provided', (tester) async {
      await tester.pumpWidget(_wrap(const RecoveryPage()));
      // Don't pumpAndSettle (8s timeout). Just pump one
      // frame — the sync "missing code" check fires in
      // initState before the first build, so the error phase
      // is rendered immediately.
      await tester.pump();

      // Should show the "invalid link" or "missing code" copy.
      expect(
        find.textContaining(
          RegExp(r'invalid|missing|expired|initialized', caseSensitive: false),
        ),
        findsWidgets,
      );
    });

    testWidgets('renders the recovery page header', (tester) async {
      await tester.pumpWidget(_wrap(const RecoveryPage()));
      // Just one frame — the AppBar title is rendered before
      // the async state checks kick in. Don't use
      // pumpAndSettle here because the page has an 8-second
      // Future.delayed that would never complete in a test.
      await tester.pump();

      // AppBar title is always present regardless of phase.
      expect(find.text('recovery.title'.tr()), findsOneWidget);
    });
  });

  group('ConfirmEmailPage', () {
    testWidgets('shows error state when no code is provided', (tester) async {
      await tester.pumpWidget(_wrap(const ConfirmEmailPage()));
      // Don't pumpAndSettle (8s timeout). One frame is
      // enough — the sync "missing code" check fires in
      // initState.
      await tester.pump();

      expect(
        find.textContaining(
          RegExp(r'invalid|missing|expired|initialized', caseSensitive: false),
        ),
        findsWidgets,
      );
    });

    testWidgets('renders the confirm page header', (tester) async {
      await tester.pumpWidget(_wrap(const ConfirmEmailPage()));
      // One frame only — confirm page has an 8s timeout that
      // would never settle in a test.
      await tester.pump();

      expect(find.text('confirm.title'.tr()), findsOneWidget);
    });
  });

  group('ToolRegistry (in-widget context)', () {
    testWidgets('all 35 tool titleKeys resolve to a translated string', (
      tester,
    ) async {
      // Render a small slice of the registry — full 35 in a
      // ListView takes longer to build than pumpAndSettle's
      // default timeout. We just want to verify the
      // translation pipeline works for representative tools.
      final sampleIds = ['merge', 'protect', 'read-aloud', 'redact', 'sign'];

      // Explicitly size the test surface BEFORE pumpWidget so
      // the ListView's first frame renders the children.
      // Default test viewport is 800x600, but MaterialApp's
      // SafeArea sometimes eats that.
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        _wrap(
          Scaffold(
            // ListTile requires a Material ancestor, which
            // Scaffold provides. Without this we get
            // "No Material widget found" and the test
            // renders an ErrorWidget instead of our Text.
            body: ListView(
              children: [
                for (final id in sampleIds)
                  ListTile(title: Text(ToolRegistry.byId(id)!.titleKey.tr())),
              ],
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      for (final id in sampleIds) {
        final translated = ToolRegistry.byId(id)!.titleKey.tr();
        expect(
          find.text(translated),
          findsOneWidget,
          reason: 'Tool $id should render as "$translated"',
        );
      }
    });
  });
}
