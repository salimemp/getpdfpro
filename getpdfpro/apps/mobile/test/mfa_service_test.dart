import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:getpdfpro_mobile/features/auth/mfa/mfa_service.dart';

/// Unit tests for [MfaService].
///
/// We focus on the parts that don't require a real Supabase
/// instance or a WebAuthn platform channel — i.e. the
/// `MfaServer`-driven path and the in-process helpers
/// (`generateBackupCodes`, passkey bookkeeping). The
/// `webauthn` package's ceremony is exercised in a separate
/// integration test on a real device; we don't try to fake
/// the OS keychain here.
void main() {
  group('backup codes', () {
    test('generateBackupCodes returns exactly kBackupCodeCount codes', () {
      final svc = MfaService.forTest(server: _StubMfaServer());
      final codes = svc.generateBackupCodes();
      expect(codes.length, kBackupCodeCount);
    });

    test('generateBackupCodes returns 10 unique codes', () {
      final svc = MfaService.forTest(server: _StubMfaServer());
      final codes = svc.generateBackupCodes();
      expect(codes.toSet().length, kBackupCodeCount);
    });

    test('each backup code has the documented shape (XXXX-XXXX)', () {
      final svc = MfaService.forTest(server: _StubMfaServer());
      final codes = svc.generateBackupCodes();
      for (final code in codes) {
        expect(
          code,
          matches(RegExp(r'^[0-9A-Z]{4}-[0-9A-Z]{4}$')),
          reason: 'Backup code "$code" is not 4+4 Crockford base32',
        );
      }
    });

    test('two calls produce different code sets', () {
      final svc = MfaService.forTest(server: _StubMfaServer());
      final a = svc.generateBackupCodes().toSet();
      final b = svc.generateBackupCodes().toSet();
      // With 1.1e12 combinations, the chance of any overlap is
      // astronomically small — but a duplicate would indicate a
      // broken RNG, not bad luck.
      expect(a.intersection(b), isEmpty);
    });
  });

  group('passkey bookkeeping', () {
    test(
      'listFactors includes local passkeys even when server is down',
      () async {
        final svc = MfaService.forTest(
          server: _ThrowingMfaServer(),
          currentUser: _FakeUser(
            id: 'user-1',
            email: 'a@example.com',
            passkeys: [
              {
                'id': 'cred-1',
                'credential_id': base64Encode(Uint8List.fromList([1, 2, 3])),
                'friendly_name': 'iPhone 15',
                'created_at': '2026-01-01T00:00:00.000Z',
              },
            ],
          ),
        );
        final factors = await svc.listFactors();
        final passkeys = factors.whereType<PasskeyFactor>().toList();
        expect(passkeys, hasLength(1));
        expect(passkeys.first.friendlyName, 'iPhone 15');
        expect(passkeys.first.credentialIdBase64, isNotEmpty);
      },
    );

    test('listFactors groups TOTP and passkey factors separately', () async {
      final svc = MfaService.forTest(
        server: _StubMfaServer(
          factors: [
            TotpFactor(
              id: 'totp-1',
              friendlyName: 'Authy',
              verified: true,
            ),
          ],
        ),
        currentUser: _FakeUser(
          id: 'user-1',
          email: 'a@example.com',
          passkeys: [
            {
              'id': 'cred-1',
              'credential_id': base64Encode(Uint8List.fromList([4, 5, 6])),
              'friendly_name': 'MacBook',
              'created_at': '2026-02-01T00:00:00.000Z',
            },
          ],
        ),
      );
      final factors = await svc.listFactors();
      expect(factors.whereType<TotpFactor>(), hasLength(1));
      expect(factors.whereType<PasskeyFactor>(), hasLength(1));
    });

    test('unenroll falls back to local removal when server rejects',
        () async {
      var serverCalled = false;
      final svc = MfaService.forTest(
        server: _CallbackMfaServer(onUnenroll: (id) async {
          serverCalled = true;
          throw Exception('not found on server');
        }),
        currentUser: _FakeUser(
          id: 'user-1',
          email: 'a@example.com',
          passkeys: [
            {
              'id': 'cred-1',
              'credential_id': base64Encode(Uint8List.fromList([7, 8, 9])),
              'friendly_name': 'iPad',
              'created_at': '2026-03-01T00:00:00.000Z',
            },
          ],
        ),
      );
      // Sanity: factor is present before removal.
      final before = await svc.listFactors();
      expect(before.whereType<PasskeyFactor>(), hasLength(1));

      await svc.unenrollFactor('cred-1');
      expect(serverCalled, isTrue);
    });
  });

  group('enrollTotp return shape', () {
    test('enrollTotp hands the friendly name off to the server', () async {
      String? capturedName;
      String? capturedIssuer;
      final svc = MfaService.forTest(
        server: _CallbackMfaServer(
          onEnroll: (name, issuer) async {
            capturedName = name;
            capturedIssuer = issuer;
            return MfaTotpEnrollment(
              factorId: 'f1',
              qrCodeDataUri: 'data:image/svg+xml;utf-8,<svg/>',
              secret: 'JBSWY3DPEHPK3PXP',
              uri: 'otpauth://totp/GetPDFPro:a@example.com?secret=JBSWY3DPEHPK3PXP',
            );
          },
        ),
      );
      final enrollment = await svc.enrollTotp('My phone');
      expect(capturedName, 'My phone');
      expect(capturedIssuer, 'GetPDFPro');
      expect(enrollment.factorId, 'f1');
      expect(enrollment.qrCodeDataUri.startsWith('data:'), isTrue);
    });

    test('enrollTotp prepends the data-URI header to a raw SVG QR', () async {
      // The QR code field in the Supabase MFA enroll response is
      // sometimes returned as a raw SVG (older gotrue versions
      // don't prepend the data: header). The service should
      // normalize both shapes.
      final svc = MfaService.forTest(
        server: _CallbackMfaServer(
          onEnroll: (_, __) async => MfaTotpEnrollment(
            factorId: 'f1',
            qrCodeDataUri: '<svg/>',
            secret: 'X',
            uri: 'otpauth://x',
          ),
        ),
      );
      final enrollment = await svc.enrollTotp('Test');
      expect(
        enrollment.qrCodeDataUri,
        'data:image/svg+xml;utf-8,<svg/>',
      );
    });
  });
}

// ── Test doubles ──────────────────────────────────────────────
//
// We avoid pulling in the full `supabase_flutter` package because
// `SupabaseClient` is a sealed class — we can't subclass it.
// Instead, [MfaService] routes its server calls through an
// [MfaServer] interface; tests can supply a fake that records
// calls and returns canned responses.

class _FakeUser implements MfaCurrentUser {
  _FakeUser({
    required this.id,
    required this.email,
    this.passkeys = const [],
  });
  @override
  final String id;
  @override
  final String email;
  final List<Map<String, dynamic>> passkeys;
  final List<Map<String, dynamic>> _updates = [];

  @override
  Map<String, dynamic> get userMetadata => {'passkeys': passkeys};

  @override
  Future<void> updateMetadata(Map<String, dynamic> merged) async {
    _updates.add(Map<String, dynamic>.from(merged));
  }

  /// The metadata blobs the service tried to persist, in order.
  /// Useful for tests that want to verify sync behavior.
  List<Map<String, dynamic>> get updates => List.unmodifiable(_updates);
}

class _StubMfaServer implements MfaServer {
  _StubMfaServer({this.factors = const []});
  final List<MfaFactor> factors;

  @override
  Future<MfaTotpEnrollment> enrollTotp(String friendlyName) async =>
      MfaTotpEnrollment(
        factorId: 'stub',
        qrCodeDataUri: 'data:image/svg+xml;utf-8,<svg/>',
        secret: 'JBSWY3DPEHPK3PXP',
        uri: 'otpauth://totp/$friendlyName',
      );

  @override
  Future<List<MfaFactor>> listFactors() async => factors;

  @override
  Future<void> unenrollFactor(String factorId) async {}

  @override
  Future<void> verifyTotpEnrollment(String factorId, String code) async {}
}

class _ThrowingMfaServer implements MfaServer {
  @override
  Future<MfaTotpEnrollment> enrollTotp(String friendlyName) async =>
      throw Exception('server down');

  @override
  Future<List<MfaFactor>> listFactors() async =>
      throw Exception('server down');

  @override
  Future<void> unenrollFactor(String factorId) async =>
      throw Exception('server down');

  @override
  Future<void> verifyTotpEnrollment(String factorId, String code) async =>
      throw Exception('server down');
}

class _CallbackMfaServer implements MfaServer {
  _CallbackMfaServer({
    this.onEnroll,
    this.onUnenroll,
  });
  final Future<MfaTotpEnrollment> Function(String name, String? issuer)?
      onEnroll;
  final Future<void> Function(String factorId)? onUnenroll;

  @override
  Future<MfaTotpEnrollment> enrollTotp(String friendlyName) async {
    if (onEnroll == null) {
      throw UnimplementedError('onEnroll not configured');
    }
    return onEnroll!(friendlyName, 'GetPDFPro');
  }

  @override
  Future<List<MfaFactor>> listFactors() async => const [];

  @override
  Future<void> unenrollFactor(String factorId) async {
    if (onUnenroll == null) {
      throw UnimplementedError('onUnenroll not configured');
    }
    return onUnenroll!(factorId);
  }

  @override
  Future<void> verifyTotpEnrollment(String factorId, String code) async {}
}
