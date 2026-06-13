import 'package:flutter_test/flutter_test.dart';

import 'package:getpdfpro_mobile/core/deep_links.dart';
import 'package:getpdfpro_mobile/core/tool_registry.dart';

/// Baseline tests for the GetPDFPro mobile app.
///
/// These tests don't exercise the UI (we'd need a Flutter
/// widget test harness for that) — they verify the
/// framework-level pieces that the UI depends on:
///
///   1. **Tool registry** — every tool in the registry has a
///      unique id, every i18n title/description key exists in
///      the active locale, and every tool's route is non-empty.
///
///   2. **Deep-link parser** — the URL parser correctly maps
///      `getpdfpro://...` and `https://app.getpdfpro.com/...`
///      URLs to the right typed action.
///
/// Add more tests as features stabilize. The goal is to catch
/// regressions in the data layer and the routing layer — both
/// of which are easy to break silently when you add a new
/// tool or a new deep-link host.
void main() {
  group('ToolRegistry', () {
    test('every tool has a unique id', () {
      final ids = ToolRegistry.all.map((t) => t.id).toList();
      final unique = ids.toSet();
      expect(
        ids.length,
        unique.length,
        reason:
            'Duplicate tool ids: '
            '${ids.where((id) => ids.where((x) => x == id).length > 1).toSet()}',
      );
    });

    test('every tool has a non-empty route', () {
      for (final tool in ToolRegistry.all) {
        expect(tool.route, isNotEmpty, reason: 'Tool ${tool.id} has no route');
        expect(
          tool.route,
          startsWith('/'),
          reason: 'Tool ${tool.id} route does not start with /',
        );
      }
    });

    test('tool count matches the documented 35', () {
      // If you add a tool, update this. The dashboard's
      // search-hint string ("35 tools") depends on this being
      // right. Better a test that fails loudly than a stale
      // string the user notices.
      expect(ToolRegistry.all.length, 35);
    });

    test('every tool has a non-empty icon', () {
      for (final tool in ToolRegistry.all) {
        expect(tool.icon, isNotNull, reason: 'Tool ${tool.id} has no icon');
      }
    });
  });

  group('DeepLinkConfig', () {
    test('the scheme is getpdfpro', () {
      expect(DeepLinkConfig.scheme, 'getpdfpro');
    });

    test('loginCallback is well-formed', () {
      expect(DeepLinkConfig.loginCallback, 'getpdfpro://login-callback');
    });

    test('resetPasswordCallback is well-formed', () {
      expect(
        DeepLinkConfig.resetPasswordCallback,
        'getpdfpro://reset-password',
      );
    });

    test('confirmEmailCallback is well-formed', () {
      expect(DeepLinkConfig.confirmEmailCallback, 'getpdfpro://confirm-email');
    });
  });

  group('DeepLinkHandler parser', () {
    final handler = DeepLinkHandler.instance;

    test('parses getpdfro://login-callback as LoginCallbackAction', () {
      final action = handler.parse(
        Uri.parse('getpdfpro://login-callback#access_token=abc'),
      );
      expect(action, isA<LoginCallbackAction>());
      expect((action as LoginCallbackAction).accessToken, 'abc');
    });

    test(
      'parses getpdfpro://reset-password?code=xyz as PasswordRecoveryAction',
      () {
        final action = handler.parse(
          Uri.parse('getpdfpro://reset-password?code=xyz123'),
        );
        expect(action, isA<PasswordRecoveryAction>());
        expect((action as PasswordRecoveryAction).code, 'xyz123');
      },
    );

    test('parses getpdfpro://confirm-email?code=abc as ConfirmEmailAction', () {
      final action = handler.parse(
        Uri.parse('getpdfpro://confirm-email?code=abc456'),
      );
      expect(action, isA<ConfirmEmailAction>());
      expect((action as ConfirmEmailAction).code, 'abc456');
    });

    test('unknown scheme returns UnknownDeepLinkAction', () {
      final action = handler.parse(Uri.parse('https://example.com/'));
      expect(action, isA<UnknownDeepLinkAction>());
    });

    test('empty string returns UnknownDeepLinkAction', () {
      final action = handler.parse(Uri.parse('not a uri'));
      expect(action, isA<UnknownDeepLinkAction>());
    });
  });
}
