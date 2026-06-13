# GetPDFPro Mobile

Cross-platform Flutter client for [GetPDFPro](https://app.getpdfpro.com). iOS, Android, Web, macOS, Windows, Linux — one Dart codebase.

The mobile app mirrors the web app's tool surface: **35 PDF tools** across 8 categories (Organize, Optimize, Convert to PDF, Convert from PDF, Edit, Security, AI tools, Accessibility). It hits the same FastAPI backend as the web app — the only difference is the client shell.

Currently **34 tools have native working implementations** (everything except Compare, which needs a two-file picker UX we haven't built yet — it lands on the "Coming soon — open on web" placeholder). Adding a new tool is a single `ToolPageSpec` entry in `simple_tool_pages.dart` — no new files needed for the 80% of tools that follow the standard "file + form fields + submit" pattern.

---

## Prerequisites

| Tool | Version | Why |
|------|---------|-----|
| Flutter SDK | 3.24.0+ | Dart 3.4+ language features, Material 3 `withValues` API |
| Dart SDK | 3.4.0+ | Bundled with Flutter |
| Xcode | 15+ (iOS/macOS) | CocoaPods for iOS deps |
| Android Studio / SDK | 34+ | Compile target |
| CocoaPods | 1.13+ | iOS dependency installer |

Install Flutter:
```bash
# macOS
brew install --cask flutter

# Verify
flutter doctor -v
```

You should see green checkmarks for Flutter, Dart, Chrome (for web), Android toolchain, and Xcode (macOS only).

---

## First-time setup

```bash
cd apps/mobile
# Generate the platform shells (ios/, android/) — only needed once
# per clone, or when adding a new platform.
flutter create --org com.getpdfpro --platforms=ios,android .
flutter pub get
# Apply the customized Info.plist + AndroidManifest (URL scheme,
# speech perms, etc.). See platform_setup/README.md.
bash platform_setup/apply.sh
cd ios && pod install && cd ..
```

If you get `flutter pub get` warnings about Dart SDK mismatches, run `flutter upgrade` first.

---

## Environment variables

The mobile app uses **compile-time** env vars (via `--dart-define`) for the API endpoint, Supabase config, and AI feature flag. There is no `.env` file — secrets are baked into the binary at build time.

| Var | Required? | Default | Purpose |
|-----|-----------|---------|---------|
| `API_URL` | No | `https://api.getpdfpro.com` | FastAPI backend base URL |
| `SUPABASE_URL` | **Yes for sign-in** | `https://YOUR_PROJECT.supabase.co` | Supabase project URL |
| `SUPABASE_ANON_KEY` | **Yes for sign-in** | (empty) | Public anon key — safe to ship |
| `AI_FEATURES_ENABLED` | No | `true` | Lets mobile users turn off Summarize/Translate on cellular |
| `GEMINI_API_KEY` | No | (empty) | Reserved; AI runs server-side today |

Example dev run (anonymous mode, no auth):
```bash
flutter run -d chrome
```

Example dev run (with auth against a real Supabase project):
```bash
flutter run -d ios \
  --dart-define=SUPABASE_URL=https://YOUR.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=eyJ...
```

If `SUPABASE_URL` is left at the placeholder, the app gracefully falls back to **anonymous mode** — tool pages and the dashboard work, but `requiresSignIn: true` tools (AI Summarize, AI Translate) will redirect the user to login. Login itself will fail until you set a real Supabase project.

---

## Running

```bash
# Pick a device first
flutter devices

# Web (Chrome) — easiest dev loop
flutter run -d chrome

# iOS Simulator
flutter run -d "iPhone 15 Pro"

# Android Emulator
flutter run -d emulator-5554

# macOS desktop
flutter run -d macos

# A specific connected device
flutter run -d <device-id>
```

Hot reload: press `r` in the terminal. Hot restart: press `R`. Quit: `q`.

---

## Building for release

```bash
# Android APK (universal, ~30 MB)
flutter build apk --release \
  --dart-define=API_URL=https://api.getpdfpro.com \
  --dart-define=SUPABASE_URL=https://YOUR.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=eyJ...

# Android App Bundle (preferred for Play Store)
flutter build appbundle --release --dart-define=...

# iOS (requires signing config)
flutter build ios --release --dart-define=...

# macOS (notarized)
flutter build macos --release --dart-define=...

# Web
flutter build web --release --dart-define=...
```

The output paths:
- `build/app/outputs/flutter-apk/app-release.apk`
- `build/app/outputs/bundle/release/app-release.aab`
- `build/ios/iphoneos/Runner.app`
- `build/macos/Build/Products/Release/getpdfpro_mobile.app`
- `build/web/`

---

## Platform-specific config

All platform-specific customizations (URL scheme, intent filters, speech + camera permissions) live in [`platform_setup/`](./platform_setup/README.md). Run `bash platform_setup/apply.sh` once after `flutter create` to merge them in.

For a one-page summary of what's customized and why, see [`platform_setup/README.md`](./platform_setup/README.md).

---

## Project structure

```
lib/
├── main.dart                          # Entrypoint. Tolerant Supabase init + deep-link init.
├── app.dart                           # MaterialApp.router + EasyLocalization.
├── core/
│   ├── env.dart                       # Compile-time env vars.
│   ├── api_client.dart                # Dio + Supabase auth interceptor.
│   ├── deep_links.dart                # Custom-scheme + Universal Link handler.
│   ├── tool_registry.dart             # 35 tools × 8 categories — single source of truth.
│   ├── router/app_router.dart         # go_router + deep-link subscription.
│   └── theme/app_theme.dart           # Light + dark Material 3 themes.
├── features/
│   ├── onboarding/welcome_page.dart   # First-run screen.
│   ├── auth/
│   │   ├── login_page.dart            # Email + magic link + Google + GitHub.
│   │   └── signup_page.dart           # Stub — uses supabase auth.
│   ├── dashboard/dashboard_page.dart  # 8 categories, search, voice command.
│   ├── settings/settings_page.dart    # Theme + language + sign out.
│   └── tools/
│       ├── merge_page.dart            # Native Merge implementation.
│       ├── compress_page.dart         # Native Compress (uses FilePickerField).
│       ├── pdf_to_image_page.dart     # Native PDF-to-Image.
│       ├── tool_placeholder.dart      # Friendly "coming soon" for the 1 not-yet-native tool.
│       ├── standard_tool_page.dart   # File-picker + form-fields + submit UX used by 26 tools.
│       ├── simple_tool_pages.dart    # Spec table + builder — adding a new tool is 1 entry here.
│       ├── text_input_tool_page.dart # AI / accessibility tools (Summarize, Translate, Read Aloud, Dictate).
│       └── widgets/
│           └── file_picker_field.dart # Reusable file picker row.
│       └── widgets/
│           └── file_picker_field.dart # Reusable file picker row.
└── ...

assets/i18n/
├── en.json                            # English (default).
└── hi.json                            # Hindi (full translation).

platform_setup/                        # Templates for the generated platform shells.
├── ios/Info.plist                     # URL scheme + speech/camera permissions.
├── android/AndroidManifest.xml        # Deep links + permissions.
├── apply.sh                           # `flutter create` then `bash platform_setup/apply.sh`.
└── README.md
```

---

## Adding a new native tool page

Three steps:

1. **Add the page** in `lib/features/tools/<name>_page.dart`. Mirror the structure of `compress_page.dart` — use `FilePickerField` for the file input, call `ApiClient.instance.dio.post(...)` to the server endpoint, write the result with `path_provider`.
2. **Register the route** in `lib/core/router/app_router.dart`. Add a static `GoRoute` for `/tools/<id>` (the catch-all `/tools/:toolId` already shows the placeholder).
3. **(Optional) Add i18n keys** to `assets/i18n/en.json` (and `hi.json`).

The dashboard auto-discovers the tool via `ToolRegistry`, so no dashboard change is needed.

---

## Internationalization

We use `easy_localization`. Currently shipped: **English + Hindi (hi)**. The 12-locale list in `lib/app.dart` covers the launch roadmap — only `en` and `hi` are fully translated today. To add a new locale:

1. Copy `assets/i18n/en.json` to `assets/i18n/<code>.json`.
2. Translate the values (keys stay the same).
3. Add `Locale('<code>')` to the `supportedLocales` list in `lib/app.dart`.
4. Add `<code>` to the `_supportedLanguages` list in `lib/features/settings/settings_page.dart`.

Missing keys gracefully fall back to English — no crash, no flicker.

---

## Troubleshooting

**"Failed to construct 'URL': Invalid URL" on every page.** Your `SUPABASE_URL` is unset, the placeholder `https://YOUR_PROJECT.supabase.co` got into the build, and Supabase threw. Either set real env vars or leave them blank and accept anonymous mode.

**Hot reload doesn't pick up i18n changes.** I18n assets are loaded once at startup. Run `flutter clean && flutter pub get` to force a re-bundle.

**File picker opens then immediately closes on iOS.** The user denied Files access the first time. Go to iOS Settings → GetPDFPro → Files & Local Network → enable. Or `flutter run --release` and reinstall.

**Speech-to-text says "Speech recognition not available" on Android.** The device doesn't have Google Speech Services installed. Sideload `com.google.android.googlequicksearchbox` or test on a Google-flavored device (Pixel, most emulators).

**"MissingPluginException: No implementation found for method pickFiles"** — `flutter pub get` resolved but the native plugin didn't link. Run `flutter clean && flutter pub get && cd ios && pod install && cd ..` then restart the app.

---

## License

Proprietary. © GetPDFPro.
