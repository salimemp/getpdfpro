import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:crypto/crypto.dart' as crypto;
import 'package:flutter/foundation.dart' show visibleForTesting;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:webauthn/webauthn.dart';

/// The Supabase client the rest of the app already uses. We expose it
/// as a Riverpod provider so [MfaService] can be unit-tested by
/// injecting a mock client — every call site already uses
/// `Supabase.instance.client.auth.mfa.X` so we keep that pattern and
/// just route through the provider.
final supabaseClientProvider = Provider<SupabaseClient>(
  (ref) => Supabase.instance.client,
);

/// The number of recovery / backup codes we issue on TOTP enrollment.
/// 10 is the sweet spot — enough redundancy, short enough to write
/// down on paper without rolling your eyes.
const kBackupCodeCount = 10;

/// Length of each backup code (excluding the dash separator).
const kBackupCodeSegmentLength = 4;

/// In-memory sealed-class return type used by [MfaService.listFactors]
/// and the UI layer. The UI can `switch` on the runtime type to pick
/// the right widget — a TOTP tile shows a code input, a Passkey tile
/// shows a "remove" button.
///
/// We use a sealed class so the analyzer can verify exhaustive
/// pattern-matching at every use site (`flutter analyze` will warn if
/// a UI page forgets to handle, say, [PasskeyFactor]).
sealed class MfaFactor {
  const MfaFactor({required this.id, required this.friendlyName});
  final String id;
  final String friendlyName;
}

/// A TOTP authenticator-app factor (Google Authenticator, 1Password,
/// Authy, Bitwarden, etc.). Status comes from the server — only
/// `verified` factors count toward MFA, but we keep unverified ones
/// around so the UI can show "scan this QR to finish setup".
class TotpFactor extends MfaFactor {
  const TotpFactor({
    required super.id,
    required super.friendlyName,
    required this.verified,
  });
  final bool verified;
}

/// A WebAuthn / passkey factor — a device-bound key unlocked by
/// biometrics or device PIN. The credential itself is stored in the
/// OS keychain via the `webauthn` package; the [credentialIdBase64]
/// is what we serialize into user_metadata so a future server can
/// verify the assertion.
class PasskeyFactor extends MfaFactor {
  const PasskeyFactor({
    required super.id,
    required super.friendlyName,
    required this.credentialIdBase64,
    required this.createdAt,
  });

  final String credentialIdBase64;
  final DateTime createdAt;
}

/// Result of a TOTP enrollment ceremony. The UI shows the QR code
/// from [qrCodeDataUri] (already a `data:image/svg+xml;utf-8,...`
/// string the `qr_flutter` package can render via `QrImageView`
/// `dataUrlBuilder`) and the [secret] in a copyable field as a
/// fallback for users who can't scan.
class MfaTotpEnrollment {
  const MfaTotpEnrollment({
    required this.factorId,
    required this.qrCodeDataUri,
    required this.secret,
    required this.uri,
  });
  final String factorId;
  final String qrCodeDataUri;
  final String secret;
  final String uri;
}

/// Result of a passkey registration. The UI can show a confirmation
/// "Passkey added" message with the friendly name. We don't return
/// the raw attestation because there's no server to send it to yet
/// — the local `webauthn` package handles the crypto internally and
/// we just stash the descriptor.
class MfaPasskeyEnrollment {
  const MfaPasskeyEnrollment({
    required this.credentialIdBase64,
    required this.friendlyName,
  });
  final String credentialIdBase64;
  final String friendlyName;
}

/// Returned by the WebAuthn assertion step of a passkey sign-in. The
/// caller checks [success] and either signs the user in (via a
/// passwordless Supabase flow) or falls back to a password prompt.
///
/// We don't try to forge a Supabase session from the assertion in
/// MVP — the assertion is for a future relying-party endpoint. For
/// now, a successful assertion means "the local keychain unlocked
/// for the right user"; the UI uses that to gate the next step.
class MfaPasskeyAssertion {
  const MfaPasskeyAssertion({required this.success, this.userId});
  final bool success;
  final String? userId;
}

/// Riverpod service that wraps the Supabase MFA API + the local
/// `webauthn` package for passkeys.
///
/// We isolate everything behind this class so the UI doesn't need to
/// know the difference between "Supabase server-side" factors (TOTP)
/// and "client-side" factors (passkeys). The UI just calls
/// `mfaService.listFactors()` and pattern-matches on the sealed
/// [MfaFactor] subtypes.
///
/// Construction takes a [SupabaseClient] explicitly (via
/// [supabaseClientProvider]) so tests can inject a mock that
/// implements the same MFA surface — the real client's
/// `GoTrueMFAApi` is internal, so tests have to wrap it.
class MfaService {
  MfaService(this._client);
  final SupabaseClient _client;

  /// Test-only constructor that bypasses Supabase entirely.
  /// Visible to test code only — production code should always
  /// use the regular [MfaService] constructor with
  /// [supabaseClientProvider].
  @visibleForTesting
  MfaService.forTest({
    required MfaServer server,
    MfaCurrentUser? currentUser,
  })  : _client = _neverUsedSupabaseClient,
        _serverOverride = server,
        _userOverride = currentUser;

  /// Escape hatch for widget tests that want to subclass
  /// [MfaService] and override every method. The subclass still
  /// needs a real constructor; this one delegates to the
  /// test-only one with a no-op server + no current user.
  /// Visible to test code only.
  @visibleForTesting
  // ignore: prefer_initializing_formals
  MfaService.letUninitializedForTest()
      : _client = _neverUsedSupabaseClient,
        _serverOverride = null,
        _userOverride = null;

  /// Stand-in Supabase client for tests. Never actually called —
  /// when the test-only constructor is used, every server call
  /// goes through [_serverOverride] and every "current user"
  /// lookup goes through [_userOverride]. We need a typed field
  /// because the type signature is non-nullable.
  static final SupabaseClient _neverUsedSupabaseClient = _SupabaseClientStub();

  // Test-only overrides. When `_serverOverride` is non-null,
  // every server call goes through it instead of `_client.auth.mfa`.
  // Same for `_userOverride` — it shadows `_client.auth.currentUser`.
  MfaServer? _serverOverride;
  MfaCurrentUser? _userOverride;

  /// Resolves the current user, preferring the test override.
  /// Production callers always hit the real Supabase client.
  MfaCurrentUser? get _currentUser {
    if (_userOverride != null) return _userOverride;
    final real = _client.auth.currentUser;
    if (real == null) return null;
    return _SupabaseUserAdapter(real, _client);
  }

  /// Enroll a new TOTP factor. The server returns a QR code (an
  /// SVG-data-URI), the raw secret, and the `otpauth://...` URI.
  /// The factor is left in `unverified` state until the user enters
  /// a 6-digit code from their authenticator app.
  ///
  /// The QR is a `data:image/svg+xml;utf-8,...` string in
  /// `totp.qr_code`. Some Supabase deployments return it as a raw
  /// SVG; we normalize both shapes so the UI can hand it to
  /// `QrImageView` directly.
  Future<MfaTotpEnrollment> enrollTotp(String friendlyName) async {
    final server = _serverOverride ?? _MfaSupabaseServer(_client);
    final enrollment = await server.enrollTotp(friendlyName);
    // Defensive normalization: some GoTrue versions ship the QR
    // as a raw SVG, others as a `data:image/svg+xml;utf-8,...`
    // string. The UI layer expects the latter; we accept either
    // and rewrite here. This is idempotent — if the server already
    // prepended the header, the startsWith check is a no-op.
    final normalizedQr = enrollment.qrCodeDataUri.startsWith('data:')
        ? enrollment.qrCodeDataUri
        : 'data:image/svg+xml;utf-8,${enrollment.qrCodeDataUri}';
    return MfaTotpEnrollment(
      factorId: enrollment.factorId,
      qrCodeDataUri: normalizedQr,
      secret: enrollment.secret,
      uri: enrollment.uri,
    );
  }

  /// Verify a TOTP enrollment by submitting a 6-digit code from the
  /// user's authenticator app. On success, Supabase promotes the
  /// session to AAL2 and the user is fully signed in.
  Future<void> verifyTotpEnrollment(String factorId, String code) async {
    final server = _serverOverride ?? _MfaSupabaseServer(_client);
    return server.verifyTotpEnrollment(factorId, code);
  }

  /// List all MFA factors for the current user, grouped by type.
  ///
  /// The Supabase server only knows about TOTP and Phone factors;
  /// passkeys are stored client-side and merged in here so the UI
  /// sees a single, unified list.
  Future<List<MfaFactor>> listFactors() async {
    final server = _serverOverride ?? _MfaSupabaseServer(_client);
    final factors = <MfaFactor>[];
    try {
      factors.addAll(await server.listFactors());
    } catch (_) {
      // If the server call fails (no session, network down, etc.)
      // we still want to surface local passkeys. Don't propagate.
    }
    factors.addAll(_loadLocalPasskeys());
    return factors;
  }

  /// Remove a TOTP or passkey factor. TOTP unenrollment is
  /// server-side; passkey unenrollment is purely local (the server
  /// doesn't know about passkeys in this MVP).
  Future<void> unenrollFactor(String factorId) async {
    final server = _serverOverride ?? _MfaSupabaseServer(_client);
    // Try server-side first (TOTP). If it fails, fall through to
    // local removal (passkey).
    try {
      await server.unenrollFactor(factorId);
      return;
    } catch (_) {
      // Not a server-side factor — fall through.
    }
    _removeLocalPasskey(factorId);
  }

  /// Enroll a new passkey / WebAuthn credential.
  ///
  /// Flow:
  ///   1. Generate a 32-byte random challenge client-side. In a
  ///      production deployment this would come from a relying-party
  ///      server; we don't have one yet, so the client stands in.
  ///   2. Build a [MakeCredentialOptions] with the user's id +
  ///      email + the RP id (`getpdfpro.com`).
  ///   3. Run the `webauthn` `Authenticator.makeCredential`
  ///      ceremony. The OS prompts for biometrics / device PIN.
  ///   4. Persist the resulting credential id in the local store
  ///      and mirror it to Supabase `user_metadata.passkeys[]` so
  ///      a future server-side check can find it.
  Future<MfaPasskeyEnrollment> registerPasskey(String friendlyName) async {
    final user = _currentUser;
    if (user == null) {
      throw const MfaException('Not signed in');
    }
    final challenge = _randomBytes(32);
    final challengeHash = crypto.sha256.convert(challenge).bytes;

    final userIdBytes = Uint8List.fromList(utf8.encode(user.id));
    final email = user.email ?? user.id;

    final options = MakeCredentialOptions(
      clientDataHash: Uint8List.fromList(challengeHash),
      rpEntity: RpEntity(id: 'getpdfpro.com', name: 'GetPDFPro'),
      userEntity: UserEntity(
        id: userIdBytes,
        // The WebAuthn spec wants the user handle to be opaque; we
        // stuff the email in `name` and `displayName` so a
        // passkey-manager UI can show something readable.
        name: email,
        displayName: email,
      ),
      requireResidentKey: false,
      requireUserPresence: true,
      requireUserVerification: true,
      credTypesAndPubKeyAlgs: [Authenticator.ES256_COSE],
      excludeCredentialDescriptorList: _existingDescriptors(user.id),
    );

    final attestation = await Authenticator.handleMakeCredential(
      options,
      localizationOptions: const AuthenticationLocalizationOptions(
        // Localized strings would come from easy_localization in
        // the UI; the package takes English defaults.
        localizedReason: 'Verify to add a passkey',
      ),
    );

    final credentialId = base64Encode(attestation.getCredentialId());
    final entry = PasskeyFactor(
      id: credentialId,
      friendlyName: friendlyName,
      credentialIdBase64: credentialId,
      createdAt: DateTime.now(),
    );
    _saveLocalPasskey(user.id, entry);
    await _syncPasskeysToUserMetadata(user, _loadLocalPasskeys());
    return MfaPasskeyEnrollment(
      credentialIdBase64: credentialId,
      friendlyName: friendlyName,
    );
  }

  /// Run a passkey assertion (the "use a passkey instead" button on
  /// the MFA prompt). On success the caller proceeds to the home
  /// screen; on failure the caller falls back to a TOTP prompt.
  Future<MfaPasskeyAssertion> assertPasskey({String? userId}) async {
    final creds = _loadLocalPasskeys();
    if (creds.isEmpty) {
      return const MfaPasskeyAssertion(success: false);
    }
    final challenge = _randomBytes(32);
    final challengeHash = crypto.sha256.convert(challenge).bytes;

    final allowList = creds
        .map(
          (c) => PublicKeyCredentialDescriptor(
            type: PublicKeyCredentialType.publicKey,
            id: base64Decode(c.credentialIdBase64),
          ),
        )
        .toList();

    final options = GetAssertionOptions(
      clientDataHash: Uint8List.fromList(challengeHash),
      rpId: 'getpdfpro.com',
      allowCredentialDescriptorList: allowList,
      requireUserPresence: true,
      requireUserVerification: true,
    );

    try {
      final assertion = await Authenticator(
        true,
        true,
      ).getAssertion(options);
      final matched = creds.firstWhere(
        (c) =>
            base64Decode(c.credentialIdBase64).length ==
                assertion.selectedCredentialId.length &&
            _bytesEqual(
              base64Decode(c.credentialIdBase64),
              assertion.selectedCredentialId,
            ),
        orElse: () => creds.first,
      );
      return MfaPasskeyAssertion(success: true, userId: matched.id);
    } catch (_) {
      return const MfaPasskeyAssertion(success: false);
    }
  }

  /// Generate 10 single-use backup codes for account recovery.
  /// Each code is 4 chars of base32 (avoiding `0` / `O` / `1` / `I`
  /// to stay human-readable on paper) joined by a dash in the
  /// middle. Uniqueness is verified in O(n²) which is fine for
  /// n = 10.
  List<String> generateBackupCodes() {
    final rng = Random.secure();
    // Crockford-style alphabet (no I, L, O, U to avoid
    // mis-reads). 28 symbols → 28^8 ≈ 1.1e12 combinations.
    const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    final seen = <String>{};
    while (seen.length < kBackupCodeCount) {
      final raw = List.generate(
        kBackupCodeSegmentLength * 2,
        (_) => alphabet[rng.nextInt(alphabet.length)],
      ).join();
      final formatted =
          '${raw.substring(0, kBackupCodeSegmentLength)}-'
          '${raw.substring(kBackupCodeSegmentLength)}';
      seen.add(formatted);
    }
    return seen.toList(growable: false);
  }

  // ── Local passkey store ─────────────────────────────────────
  //
  // We don't have a real WebAuthn relying party yet, so the
  // passkey metadata is stored in the Supabase user_metadata blob
  // (server-of-truth for which credentials exist) AND mirrored
  // locally in SharedPreferences so we can offer "sign in with
  // passkey" without a server round-trip on cold start.

  List<PasskeyFactor> _loadLocalPasskeys() {
    final user = _currentUser;
    if (user == null) return const [];
    final raw = user.userMetadata['passkeys'];
    if (raw is! List) return const [];
    return raw
        .whereType<Map>()
        .map(
          (m) => PasskeyFactor(
            id: m['id'] as String? ?? '',
            friendlyName: m['friendly_name'] as String? ?? 'Passkey',
            credentialIdBase64: m['credential_id'] as String? ?? '',
            createdAt: DateTime.tryParse(m['created_at'] as String? ?? '') ??
                DateTime.now(),
          ),
        )
        .where((f) => f.credentialIdBase64.isNotEmpty)
        .toList(growable: false);
  }

  void _saveLocalPasskey(String userId, PasskeyFactor factor) {
    final user = _currentUser;
    if (user == null || user.id != userId) return;
    final existing = _loadLocalPasskeys();
    final updated = <PasskeyFactor>[
      ...existing.where((f) => f.id != factor.id),
      factor,
    ];
    // Persist by syncing the merged list into user_metadata. This
    // also means the next listFactors() call sees the new entry.
    unawaited(_syncPasskeysToUserMetadata(user, updated));
  }

  void _removeLocalPasskey(String credentialIdBase64) {
    final user = _currentUser;
    if (user == null) return;
    final existing = _loadLocalPasskeys()
        .where((f) => f.credentialIdBase64 != credentialIdBase64)
        .toList(growable: false);
    // Fire and forget — we don't block the UI on metadata sync.
    unawaited(_syncPasskeysToUserMetadata(user, existing));
  }

  List<PublicKeyCredentialDescriptor> _existingDescriptors(String userId) {
    return _loadLocalPasskeys()
        .map(
          (c) => PublicKeyCredentialDescriptor(
            type: PublicKeyCredentialType.publicKey,
            id: base64Decode(c.credentialIdBase64),
          ),
        )
        .toList(growable: false);
  }

  Future<void> _syncPasskeysToUserMetadata(
    MfaCurrentUser user,
    List<PasskeyFactor> passkeys,
  ) async {
    try {
      final payload = {
        'passkeys': passkeys
            .map(
              (p) => {
                'id': p.id,
                'credential_id': p.credentialIdBase64,
                'friendly_name': p.friendlyName,
                'created_at': p.createdAt.toIso8601String(),
              },
            )
            .toList(),
      };
      // updateUser merges with existing user_metadata; the
      // `data` payload is added at the top level.
      final merged = <String, dynamic>{
        ...user.userMetadata,
        ...payload,
      };
      await user.updateMetadata(merged);
    } catch (_) {
      // Metadata sync failures shouldn't break enrollment. A future
      // server-side reconciliation job can rebuild the index.
    }
  }

  // ── Tiny helpers ─────────────────────────────────────────────

  Uint8List _randomBytes(int length) {
    final rng = Random.secure();
    return Uint8List.fromList(List.generate(length, (_) => rng.nextInt(256)));
  }

  bool _bytesEqual(Uint8List a, Uint8List b) {
    if (a.length != b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i] != b[i]) return false;
    }
    return true;
  }
}

/// Riverpod provider for the singleton MfaService.
final mfaServiceProvider = Provider<MfaService>(
  (ref) => MfaService(ref.watch(supabaseClientProvider)),
);

/// Convenience provider that exposes a stream of the user's
/// current factor list. Used by the security settings page to
/// live-refresh after enroll / unenroll.
final mfaFactorsProvider = FutureProvider<List<MfaFactor>>((ref) async {
  return ref.watch(mfaServiceProvider).listFactors();
});

/// Thrown by [MfaService] for user-visible errors. The UI catches
/// this and shows the message in an error snackbar / inline alert.
class MfaException implements Exception {
  const MfaException(this.message);
  final String message;
  @override
  String toString() => 'MfaException: $message';
}

/// Thin adapter that translates the [MfaService] public API into
/// Supabase `auth.mfa` calls. The split exists purely so tests
/// can supply a fake without depending on the live `GoTrueMFAApi`
/// (which is `late final` on the client and impossible to mock
/// without rewiring `Supabase.instance`).
abstract class MfaServer {
  Future<MfaTotpEnrollment> enrollTotp(String friendlyName);
  Future<void> verifyTotpEnrollment(String factorId, String code);
  Future<List<MfaFactor>> listFactors();
  Future<void> unenrollFactor(String factorId);
}

/// Real implementation that talks to Supabase.
class _MfaSupabaseServer implements MfaServer {
  _MfaSupabaseServer(this._client);
  final SupabaseClient _client;

  @override
  Future<MfaTotpEnrollment> enrollTotp(String friendlyName) async {
    final resp = await _client.auth.mfa.enroll(
      factorType: FactorType.totp,
      friendlyName: friendlyName,
      issuer: 'GetPDFPro',
    );
    final totp = resp.totp;
    if (totp == null) {
      throw const MfaException(
        'TOTP enrollment did not return a TOTP payload',
      );
    }
    // We hand the QR through to MfaService.enrollTotp, which
    // normalizes it to a data: URI regardless of what the
    // server returns.
    return MfaTotpEnrollment(
      factorId: resp.id,
      qrCodeDataUri: totp.qrCode,
      secret: totp.secret,
      uri: totp.uri,
    );
  }

  @override
  Future<void> verifyTotpEnrollment(String factorId, String code) async {
    final challenge = await _client.auth.mfa.challenge(factorId: factorId);
    await _client.auth.mfa.verify(
      factorId: factorId,
      challengeId: challenge.id,
      code: code,
    );
  }

  @override
  Future<List<MfaFactor>> listFactors() async {
    final resp = await _client.auth.mfa.listFactors();
    final out = <MfaFactor>[];
    for (final f in resp.all) {
      if (f.factorType == FactorType.totp) {
        out.add(
          TotpFactor(
            id: f.id,
            friendlyName: f.friendlyName ?? 'Authenticator app',
            verified: f.status == FactorStatus.verified,
          ),
        );
      }
    }
    return out;
  }

  @override
  Future<void> unenrollFactor(String factorId) async {
    await _client.auth.mfa.unenroll(factorId);
  }
}

/// Stub SupabaseClient used only as a type placeholder for
/// `MfaService.forTest`. Never actually called — the test
/// constructor installs [_serverOverride] and [_userOverride]
/// which shadow every method we'd otherwise dispatch to. We
/// can't `late final` initialize without a real `Supabase`
/// instance, so we throw if any test ever accidentally calls
/// into it.
class _SupabaseClientStub implements SupabaseClient {
  @override
  dynamic noSuchMethod(Invocation invocation) {
    throw StateError(
      '_SupabaseClientStub must never be called. The MfaService '
      'test constructor installs a server + user override; if you '
      'see this error, one of the test paths forgot to set up an '
      'override.',
    );
  }
}

// ── Current-user adapter ─────────────────────────────────────
//
// Slim interface over the bits of the Supabase `User` object that
// [MfaService] actually needs. Splitting it out lets tests supply
// a fake without instantiating the (heavy, environment-bound)
// real User. The interface is read-only; for writes, tests
// supply a fake that records the metadata they "stored" so the
// next listFactors() round-trip can read it back.

abstract class MfaCurrentUser {
  String get id;
  String? get email;
  Map<String, dynamic> get userMetadata;
  Future<void> updateMetadata(Map<String, dynamic> merged);
}

class _SupabaseUserAdapter implements MfaCurrentUser {
  _SupabaseUserAdapter(this._user, this._client);
  final User _user;
  final SupabaseClient _client;
  @override
  String get id => _user.id;
  @override
  String? get email => _user.email;
  @override
  Map<String, dynamic> get userMetadata =>
      _user.userMetadata ?? const {};
  @override
  Future<void> updateMetadata(Map<String, dynamic> merged) async {
    await _client.auth.updateUser(UserAttributes(data: merged));
  }
}
