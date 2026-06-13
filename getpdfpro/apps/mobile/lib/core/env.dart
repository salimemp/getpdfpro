/// Environment configuration. Compile-time via --dart-define.
///
/// Example (development):
/// ```
/// flutter run \
///   --dart-define=API_URL=https://api.getpdfpro.com \
///   --dart-define=SUPABASE_URL=https://YOUR.supabase.co \
///   --dart-define=SUPABASE_ANON_KEY=eyJ...
/// ```
///
/// For production builds, see scripts/build-mobile.sh in the repo
/// root — it bakes in the right values per platform.
class Env {
  /// The GetPDFPro FastAPI backend.
  ///
  /// Default points to the production backend so a `flutter run`
  /// against the production API works out of the box. Override with
  /// `--dart-define=API_URL=http://localhost:8000` for local dev.
  static const String apiUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'https://api.getpdfpro.com',
  );

  /// The Supabase project that hosts auth + the quota counter.
  /// Placeholder here — must be set at build time. See README.
  static const String supabaseUrl = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'https://YOUR_PROJECT.supabase.co',
  );

  /// Public anon key for Supabase. Safe to ship in the client.
  /// Empty by default — must be set at build time.
  static const String supabaseAnonKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue: '',
  );

  /// Gemini API key (only used by Summarize / Translate tools on the
  /// server side, not on the device). Kept here for parity with the
  /// web app's env story; left empty in mobile builds.
  static const String geminiApiKey = String.fromEnvironment(
    'GEMINI_API_KEY',
    defaultValue: '',
  );

  /// Enable AI features on the device (Summarize / Translate via
  /// the server). Off by default in the mobile app — users on
  /// cellular may prefer to skip these. Toggle in Settings.
  static const bool aiFeaturesEnabled = bool.fromEnvironment(
    'AI_FEATURES_ENABLED',
    defaultValue: true,
  );

  /// App version + build metadata. Surfaces in the Settings page
  /// for support tickets.
  static const String appVersion = '0.1.0';
  static const String appBuild = '1';
  static const String appName = 'GetPDFPro';
  static const String supportEmail = 'support@getpdfpro.com';
  static const String websiteUrl = 'https://app.getpdfpro.com';

  /// Timeouts for the API client. Mobile networks can be slow; we
  /// give every request a 30s default (Adobe-backed tools can take
  /// 10-20s on a busy day) and uploads 60s.
  static const Duration apiTimeout = Duration(seconds: 30);
  static const Duration uploadTimeout = Duration(seconds: 60);
  static const Duration downloadTimeout = Duration(seconds: 60);
}
