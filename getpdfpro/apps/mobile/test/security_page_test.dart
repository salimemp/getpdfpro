import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
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

import 'package:getpdfpro_mobile/features/auth/mfa/mfa_service.dart';
import 'package:getpdfpro_mobile/features/settings/security_page.dart';

/// Widget tests for the Security & sign-in page.
///
/// We override [mfaServiceProvider] (and the
/// [mfaFactorsProvider] that depends on it) with a fake service
/// that returns canned factor lists. The page itself is the
/// "scaffold under test" — we don't mock individual widgets,
/// we exercise the full tree.
///
/// What's covered:
///   1. The page renders both the TOTP and the passkey section
///      headers (and the recovery-codes section) when there are
///      no factors enrolled.
///   2. Tapping "Add a passkey" → friendly-name dialog → submit
///      calls `registerPasskey` exactly once on the service.
///   3. Tapping the trash icon on an existing passkey row calls
///      `unenrollFactor` with the right factor id.
///   4. Tapping the trash icon on a TOTP row calls
///      `unenrollFactor` with the right factor id.
void main() {
  // Mock the SharedPreferences backing store (locale persists here).
  setUpAll(() {
    SharedPreferences.setMockInitialValues({});
  });

  setUp(() async {
    SharedPreferences.setMockInitialValues({});

    // Expand the test viewport to 800x1200 so the Security page's
    // ListView (TOTP section + passkey section + recovery-codes
    // section + About) fits without scrolling. The default 800x600
    // is too short — the recovery section header is below the fold
    // and the "Add a passkey" button sits where the "Add a passkey"
    // section *header* would be in the truncated layout, so
    // find.text(...).first hits the wrong widget.
    final binding = TestWidgetsFlutterBinding.ensureInitialized();
    binding.platformDispatcher.views.first.physicalSize =
        const Size(800, 1200);
    binding.platformDispatcher.views.first.devicePixelRatio = 1.0;

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
    Localization.load(
      const Locale('en'),
      translations: controller.translations,
    );
  });

  tearDown(() {
    final binding = TestWidgetsFlutterBinding.ensureInitialized();
    binding.platformDispatcher.views.first.resetPhysicalSize();
    binding.platformDispatcher.views.first.resetDevicePixelRatio();
  });

  Widget wrap(Widget child) {
    return MaterialApp(
      home: child,
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [Locale('en')],
    );
  }

  group('SecurityPage rendering', () {
    testWidgets('renders TOTP + passkey + recovery sections when empty',
        (tester) async {
      final fake = _RecordingMfaService();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            mfaServiceProvider.overrideWithValue(fake),
          ],
          child: wrap(const SecurityPage()),
        ),
      );
      await tester.pumpAndSettle();

      // Section headers — toUpperCase() is applied in the
      // SectionHeader widget, so the text we look for is the
      // uppercased version.
      expect(
        find.text('security.section_totp'.tr().toUpperCase()),
        findsOneWidget,
      );
      expect(
        find.text('security.section_passkeys'.tr().toUpperCase()),
        findsOneWidget,
      );
      expect(
        find.text('security.section_recovery'.tr().toUpperCase()),
        findsOneWidget,
      );

      // "Empty state" copy.
      expect(find.text('security.totp_no_factors'.tr()), findsOneWidget);
      expect(
        find.text('security.passkey_no_passkeys'.tr()),
        findsOneWidget,
      );

      // Action buttons. The page is a ListView — the recovery-codes
      // ListTile may live outside the default 800x600 test
      // viewport, so we check the FilledButtons via their text and
      // use findsAtLeastNWidgets for the ListTile to be defensive
      // about render layer caching.
      expect(find.text('security.totp_enroll'.tr()), findsOneWidget);
      expect(find.text('security.passkey_add'.tr()), findsOneWidget);
      // Scroll the page to reveal the recovery section.
      await tester.drag(
        find.byType(ListView),
        const Offset(0, -1000),
      );
      await tester.pumpAndSettle();
      expect(
        find.text('security.regenerate'.tr()),
        findsAtLeastNWidgets(1),
      );
    });

    testWidgets('renders existing factors with their friendly names',
        (tester) async {
      final fake = _RecordingMfaService(
        factors: [
          TotpFactor(
            id: 'totp-1',
            friendlyName: 'Authy',
            verified: true,
          ),
          PasskeyFactor(
            id: 'cred-1',
            friendlyName: 'iPhone 15',
            credentialIdBase64: 'YWJjZGVm',
            createdAt: DateTime(2026, 1, 1),
          ),
        ],
      );
      await tester.pumpWidget(
        ProviderScope(
          overrides: [mfaServiceProvider.overrideWithValue(fake)],
          child: wrap(const SecurityPage()),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Authy'), findsOneWidget);
      expect(find.text('iPhone 15'), findsOneWidget);
    });
  });

  group('SecurityPage interactions', () {
    testWidgets('tapping "Add a passkey" calls registerPasskey', (tester) async {
      final fake = _RecordingMfaService();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [mfaServiceProvider.overrideWithValue(fake)],
          child: wrap(const SecurityPage()),
        ),
      );
      await tester.pumpAndSettle();

      // Tap the "Add a passkey" button. There are several
      // matches because the page renders one button in the
      // passkey section. The .first is the section's main
      // button (not inside a dialog).
      await tester.tap(find.text('security.passkey_add'.tr()).first);
      await tester.pumpAndSettle();

      // A name dialog appears. The default name is a generated
      // value like "Passkey 1234567890" — accept it. The
      // "security.passkey_add" text appears as the action
      // button label inside the dialog.
      expect(find.byType(AlertDialog), findsOneWidget);
      await tester.tap(find.text('security.passkey_add'.tr()).last);
      // Give the future microtask queue a chance to settle —
      // the dialog dismiss fires Navigator.pop which resolves
      // the showDialog future.
      await tester.pumpAndSettle();

      // The service should have been called.
      expect(fake.registerPasskeyCalls, 1);
    });

    testWidgets(
      'tapping the trash icon on a passkey calls unenrollFactor',
      (tester) async {
        final fake = _RecordingMfaService(
          factors: [
            PasskeyFactor(
              id: 'cred-1',
              friendlyName: 'iPhone 15',
              credentialIdBase64: 'YWJjZGVm',
              createdAt: DateTime(2026, 1, 1),
            ),
          ],
        );
        await tester.pumpWidget(
          ProviderScope(
            overrides: [mfaServiceProvider.overrideWithValue(fake)],
            child: wrap(const SecurityPage()),
          ),
        );
        await tester.pumpAndSettle();

        // Find the trash icon (delete_outline) in the passkey row.
        final trashIcon = find.descendant(
          of: find.ancestor(
            of: find.text('iPhone 15'),
            matching: find.byType(ListTile),
          ),
          matching: find.byIcon(Icons.delete_outline),
        );
        expect(trashIcon, findsOneWidget);
        await tester.tap(trashIcon);
        await tester.pumpAndSettle();

        // Confirm dialog appears.
        expect(find.byType(AlertDialog), findsOneWidget);
        await tester.tap(find.text('common.delete'.tr()));
        await tester.pumpAndSettle();

        // Service should have been called with the right id.
        expect(fake.unenrollCalls, contains('cred-1'));
      },
    );

    testWidgets(
      'tapping the trash icon on a TOTP factor calls unenrollFactor',
      (tester) async {
        final fake = _RecordingMfaService(
          factors: [
            TotpFactor(
              id: 'totp-1',
              friendlyName: 'Authy',
              verified: true,
            ),
          ],
        );
        await tester.pumpWidget(
          ProviderScope(
            overrides: [mfaServiceProvider.overrideWithValue(fake)],
            child: wrap(const SecurityPage()),
          ),
        );
        await tester.pumpAndSettle();

        final trashIcon = find.descendant(
          of: find.ancestor(
            of: find.text('Authy'),
            matching: find.byType(ListTile),
          ),
          matching: find.byIcon(Icons.delete_outline),
        );
        expect(trashIcon, findsOneWidget);
        await tester.tap(trashIcon);
        await tester.pumpAndSettle();

        expect(find.byType(AlertDialog), findsOneWidget);
        await tester.tap(find.text('common.delete'.tr()));
        await tester.pumpAndSettle();

        expect(fake.unenrollCalls, contains('totp-1'));
      },
    );
  });
}

// ── Test doubles ──────────────────────────────────────────────

class _RecordingMfaService extends MfaService {
  _RecordingMfaService({this.factors = const []})
      : super.letUninitializedForTest();

  final List<MfaFactor> factors;
  int registerPasskeyCalls = 0;
  final List<String> unenrollCalls = [];

  @override
  Future<MfaTotpEnrollment> enrollTotp(String friendlyName) async =>
      MfaTotpEnrollment(
        factorId: 'totp-${factors.length + 1}',
        qrCodeDataUri: 'data:image/svg+xml;utf-8,<svg/>',
        secret: 'JBSWY3DPEHPK3PXP',
        uri: 'otpauth://totp/$friendlyName',
      );

  @override
  Future<void> verifyTotpEnrollment(String factorId, String code) async {}

  @override
  Future<List<MfaFactor>> listFactors() async => factors;

  @override
  Future<void> unenrollFactor(String factorId) async {
    unenrollCalls.add(factorId);
  }

  @override
  Future<MfaPasskeyEnrollment> registerPasskey(String friendlyName) async {
    registerPasskeyCalls++;
    return MfaPasskeyEnrollment(
      credentialIdBase64: 'YWJjZGVm',
      friendlyName: friendlyName,
    );
  }

  @override
  Future<MfaPasskeyAssertion> assertPasskey({String? userId}) async =>
      const MfaPasskeyAssertion(success: false);

  @override
  List<String> generateBackupCodes() => List.generate(
        kBackupCodeCount,
        (i) => 'AAAA-${i.toString().padLeft(4, '0')}',
      );
}
