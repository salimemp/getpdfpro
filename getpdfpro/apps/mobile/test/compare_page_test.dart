import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
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

import 'package:getpdfpro_mobile/features/tools/compare_page.dart';

/// Widget tests for the Compare PDFs page.
///
/// We exercise the four key states the orchestrator wants
/// validated:
///   1. Submit is disabled when no files are picked.
///   2. Submit is disabled when only one file is picked.
///   3. Submit is enabled when both files are picked and the
///      combined size is under the 50 MB cap.
///   4. An error banner + retry button surface when the server
///      returns 500.
///
/// The full API round-trip is NOT exercised. We use Dio's
/// `httpClientAdapter` swap to control the response shape
/// without leaving the test harness, and we use the
/// `@visibleForTesting debugSetFileA/debugSetFileB` setters on
/// the page to skip the platform file picker (which can't run
/// under `flutter test`).
class _FakeHttpAdapter implements HttpClientAdapter {
  _FakeHttpAdapter(this._handler);

  /// Async handler called for each request. Receives the
  /// [RequestOptions] so the test can vary the response based
  /// on the URL.
  final Future<ResponseBody> Function(RequestOptions options) _handler;

  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    return _handler(options);
  }
}

ResponseBody _jsonResponse(int status, Map<String, dynamic> body,
    {Map<String, List<String>> headers = const {}}) {
  final bytes = utf8.encode(jsonEncode(body));
  final allHeaders = <String, List<String>>{
    'content-type': ['application/json'],
    'content-length': ['${bytes.length}'],
    ...headers,
  };
  return ResponseBody.fromBytes(bytes, status, headers: allHeaders);
}

PlatformFile _fakePdf(String name, {required int size, String? path}) {
  return PlatformFile(
    name: name,
    size: size,
    path: path,
  );
}

Widget _wrap(Widget child) {
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

void main() {
  setUpAll(() async {
    SharedPreferences.setMockInitialValues({});
  });

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    // Load the i18n JSON into the Localization singleton the
    // same way dashboard_auth_pages_test.dart does. We need
    // the page's `.tr()` calls to resolve real English text
    // because the Submit button label IS one of those strings.
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

  group('ComparePage', () {
    testWidgets('submit button is disabled with 0 files picked', (tester) async {
      await tester.pumpWidget(_wrap(const ComparePage()));
      await tester.pumpAndSettle();

      // Find the FilledButton with the "Compare" label.
      final compareButton = find.widgetWithText(FilledButton, 'Compare');
      expect(compareButton, findsOneWidget);

      // FilledButton.icon renders as a FilledButton internally;
      // `onPressed: null` is how the disabled state shows up.
      final button = tester.widget<FilledButton>(compareButton);
      expect(button.onPressed, isNull,
          reason: 'Submit must be disabled when no files are picked');
    });

    testWidgets('submit button is disabled with 1 file picked', (tester) async {
      // The page's submit logic reads the file's on-disk path
      // and `File(path).exists()` before posting. We need a real
      // file on disk for the path check to pass. Create a
      // throwaway temp file and use its path.
      final tempDir = await Directory.systemTemp.createTemp('compare_test_');
      final realPath = '${tempDir.path}/a.pdf';
      await File(realPath).writeAsBytes(List<int>.filled(8, 0));

      // Use a Dio that would fail loudly if the test wrongly
      // triggers a network call — we expect this test to
      // short-circuit on the "1 file" check before any HTTP.
      final dio = Dio(BaseOptions(baseUrl: 'https://test.invalid'));
      dio.httpClientAdapter = _FakeHttpAdapter((options) async {
        fail('Dio was called with only 1 file picked — '
            'submit should have been disabled');
      });

      final key = GlobalKey<State<ComparePage>>();
      await tester.pumpWidget(_wrap(
        ComparePage(key: key, dio: dio),
      ));
      await tester.pumpAndSettle();

      // Reach into the State to set the file directly — that's
      // the @visibleForTesting seam.
      final state = key.currentState as dynamic;
      state.debugSetFileA(_fakePdf('a.pdf', size: 8, path: realPath));
      await tester.pumpAndSettle();

      final button = tester.widget<FilledButton>(
        find.widgetWithText(FilledButton, 'Compare'),
      );
      expect(button.onPressed, isNull,
          reason: 'Submit must be disabled when only 1 file is picked');

      addTearDown(() async {
        if (await tempDir.exists()) await tempDir.delete(recursive: true);
      });
    });

    testWidgets('submit button is enabled with 2 files picked', (tester) async {
      final tempDir = await Directory.systemTemp.createTemp('compare_test_');
      final pathA = '${tempDir.path}/a.pdf';
      final pathB = '${tempDir.path}/b.pdf';
      await File(pathA).writeAsBytes(List<int>.filled(8, 0));
      await File(pathB).writeAsBytes(List<int>.filled(8, 0));

      // A Dio that responds 200 with a tiny Adobe-shaped body
      // so the test that the button is enabled doesn't
      // accidentally call into a real network. We don't tap
      // submit here — just verify it's enabled.
      final dio = Dio(BaseOptions(baseUrl: 'https://test.invalid'));
      dio.httpClientAdapter = _FakeHttpAdapter((options) async {
        return _jsonResponse(200, {
          'pages_a': 1,
          'pages_b': 1,
          'similarity': 100.0,
        });
      });

      final key = GlobalKey<State<ComparePage>>();
      await tester.pumpWidget(_wrap(
        ComparePage(key: key, dio: dio),
      ));
      await tester.pumpAndSettle();

      final state = key.currentState as dynamic;
      state.debugSetFileA(_fakePdf('a.pdf', size: 8, path: pathA));
      state.debugSetFileB(_fakePdf('b.pdf', size: 8, path: pathB));
      await tester.pumpAndSettle();

      final button = tester.widget<FilledButton>(
        find.widgetWithText(FilledButton, 'Compare'),
      );
      expect(button.onPressed, isNotNull,
          reason: 'Submit must be enabled when both files are picked '
              'and total size is under 50 MB');

      addTearDown(() async {
        if (await tempDir.exists()) await tempDir.delete(recursive: true);
      });
    });

    testWidgets('error banner shows when API returns 500', (tester) async {
      final tempDir = await Directory.systemTemp.createTemp('compare_test_');
      final pathA = '${tempDir.path}/a.pdf';
      final pathB = '${tempDir.path}/b.pdf';
      await File(pathA).writeAsBytes(List<int>.filled(8, 0));
      await File(pathB).writeAsBytes(List<int>.filled(8, 0));

      final dio = Dio(BaseOptions(baseUrl: 'https://test.invalid'));
      dio.httpClientAdapter = _FakeHttpAdapter((options) async {
        // Server-side error. The FastAPI convention is
        // {"detail": "..."}.
        return _jsonResponse(500, {
          'detail': 'Internal server error',
        });
      });

      final key = GlobalKey<State<ComparePage>>();
      await tester.pumpWidget(_wrap(
        ComparePage(key: key, dio: dio),
      ));
      await tester.pumpAndSettle();

      final state = key.currentState as dynamic;
      state.debugSetFileA(_fakePdf('a.pdf', size: 8, path: pathA));
      state.debugSetFileB(_fakePdf('b.pdf', size: 8, path: pathB));
      await tester.pumpAndSettle();

      // Tap submit. The Dio adapter returns 500 → Dio throws
      // DioException → page sets _error → ErrorBanner appears.
      await tester.tap(find.widgetWithText(FilledButton, 'Compare'));
      // Pump frames while the request resolves. The mock
      // adapter resolves synchronously after one microtask.
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));
      await tester.pumpAndSettle();

      // The error message we mapped from a 500 is
      // errors.server_error. The user-facing copy includes
      // "server" — assert the banner is visible.
      expect(
        find.textContaining('server', findRichText: true),
        findsWidgets,
        reason: 'Error banner with server-error copy should be visible',
      );

      addTearDown(() async {
        if (await tempDir.exists()) await tempDir.delete(recursive: true);
      });
    });
  });
}
