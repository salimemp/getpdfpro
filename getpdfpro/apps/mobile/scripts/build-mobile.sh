#!/usr/bin/env bash
# =============================================================================
# GetPDFPro mobile — build script
# =============================================================================
# This script is the single source of truth for the mobile build command.
# Both CI (see .github/workflows/mobile-ci.yml) and local release builds
# should invoke this rather than calling `flutter build` directly — that
# way, signing config, --dart-define values, and platform targets all
# live in one place and CI can stay dumb.
#
# Usage:
#   scripts/build-mobile.sh            # default: release APK
#   scripts/build-mobile.sh ios        # iOS archive (no codesign)
#   scripts/build-mobile.sh ios-signed # iOS archive (codesign via Xcode)
#   scripts/build-mobile.sh debug      # debug APK
#   scripts/build-mobile.sh appbundle  # release AAB for Play Store
#
# Environment overrides (all optional):
#   FLAVOR      — "prod" (default), "staging", or "dev"
#   API_URL     — backend base URL
#   SUPABASE_URL, SUPABASE_ANON_KEY  — Supabase project creds
#   STRIPE_KEY  — Stripe publishable key (server-side; for AI features)
#
# Exit codes:
#   0  — build succeeded
#   1  — missing prerequisites (flutter, signing material)
#   2  — build failed
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$MOBILE_DIR"

# --- Prereqs ---------------------------------------------------------------
if ! command -v flutter >/dev/null 2>&1; then
  echo "Error: flutter is not on PATH." >&2
  echo "Install it from https://docs.flutter.dev/get-started/install" >&2
  exit 1
fi

# --- Defaults --------------------------------------------------------------
TARGET="${1:-apk}"  # apk | debug | ios | ios-signed | appbundle
FLAVOR="${FLAVOR:-prod}"
API_URL="${API_URL:-https://api.getpdfpro.com}"
SUPABASE_URL="${SUPABASE_URL:-https://YOUR_PROJECT.supabase.co}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-}"
# Leave empty by default; only set if you're building a feature that
# ships the key on the device.
STRIPE_KEY="${STRIPE_KEY:-}"

# --- Dart-defines shared across all targets --------------------------------
DART_DEFINES=(
  "--dart-define=FLAVOR=$FLAVOR"
  "--dart-define=API_URL=$API_URL"
  "--dart-define=SUPABASE_URL=$SUPABASE_URL"
  "--dart-define=SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY"
  "--dart-define=STRIPE_PUBLISHABLE_KEY=$STRIPE_KEY"
)

# --- Build matrix ---------------------------------------------------------
case "$TARGET" in
  apk)
    echo "==> Building release APK (fingerprint: $FLAVOR)"
    flutter build apk --release "${DART_DEFINES[@]}"
    ;;
  debug)
    echo "==> Building debug APK (fingerprint: $FLAVOR)"
    flutter build apk --debug "${DART_DEFINES[@]}"
    ;;
  appbundle)
    echo "==> Building release App Bundle (fingerprint: $FLAVOR)"
    flutter build appbundle --release "${DART_DEFINES[@]}"
    ;;
  ios)
    echo "==> Building iOS debug (no codesign)"
    flutter build ios --debug --no-codesign "${DART_DEFINES[@]}"
    ;;
  ios-signed)
    echo "==> Building iOS release (will codesign via Xcode)"
    flutter build ios --release "${DART_DEFINES[@]}"
    ;;
  *)
    echo "Unknown target: $TARGET" >&2
    echo "Valid targets: apk, debug, appbundle, ios, ios-signed" >&2
    exit 1
    ;;
esac

echo ""
echo "Done. Artifact location: build/app/outputs/flutter-apk/  (or build/ios/)"
