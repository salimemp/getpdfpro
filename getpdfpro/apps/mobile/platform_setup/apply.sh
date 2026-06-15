#!/usr/bin/env bash
#
# apply.sh — copy the platform config files from this directory into
# the Flutter project's platform dirs.
#
# USE ONLY AFTER `flutter create --platforms=ios,android .` has been
# run. The Flutter CLI is what generates `ios/Runner/Info.plist` and
# `android/app/src/main/AndroidManifest.xml` — they don't exist in
# this repo because we don't ship generated platform shells.
#
# This script OVERWRITES those files with the customized versions
# we've prepared. Diff before running if you've made local changes
# to either platform file.
#
# Usage:
#   cd apps/mobile
#   bash platform_setup/apply.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$MOBILE_DIR"

# Sanity check: platform dirs should exist after `flutter create`.
if [ ! -d "ios" ] || [ ! -d "android" ]; then
  echo "Error: ios/ and/or android/ directories not found."
  echo "Run 'flutter create --platforms=ios,android .' first."
  echo ""
  echo "If you want a different org id, run:"
  echo "  flutter create --org com.getpdfpro --platforms=ios,android ."
  exit 1
fi

echo "==> Copying ios/Runner/Info.plist"
cp "$SCRIPT_DIR/ios/Info.plist" ios/Runner/Info.plist

# Universal Links — the entitlements file is what tells iOS our app
# is allowed to claim the applinks:app.getpdfpro.com domain. The Xcode
# project references it via CODE_SIGN_ENTITLEMENTS (see
# ios/Runner.xcodeproj/project.pbxproj).
if [ -f "$SCRIPT_DIR/ios/Runner.entitlements" ]; then
  echo "==> Copying ios/Runner/Runner.entitlements"
  cp "$SCRIPT_DIR/ios/Runner.entitlements" ios/Runner/Runner.entitlements
fi

echo "==> Copying android/app/src/main/AndroidManifest.xml"
cp "$SCRIPT_DIR/android/AndroidManifest.xml" android/app/src/main/AndroidManifest.xml

# App Links — Android reads the assetlinks.json at install time to
# verify our app against the SHA-256 cert fingerprint of the signing
# key. The user MUST replace the placeholder fingerprint with the
# real one (see key.properties.example for how to extract it).
if [ -f "$SCRIPT_DIR/android/assetlinks.json" ]; then
  echo "==> Copying android/app/src/main/res/values/assetlinks.json"
  mkdir -p android/app/src/main/res/values
  cp "$SCRIPT_DIR/android/assetlinks.json" android/app/src/main/res/values/assetlinks.json
fi

echo ""
echo "Done. Verify the changes look right:"
echo "  diff <(git show HEAD:ios/Runner/Info.plist) ios/Runner/Info.plist"
echo "  diff <(git show HEAD:ios/Runner/Runner.entitlements) ios/Runner/Runner.entitlements 2>/dev/null || true"
echo "  diff <(git show HEAD:android/app/src/main/AndroidManifest.xml) android/app/src/main/AndroidManifest.xml"
echo "  diff <(git show HEAD:android/app/src/main/res/values/assetlinks.json) android/app/src/main/res/values/assetlinks.json 2>/dev/null || true"
echo ""
echo "Next steps:"
echo "  1. flutter pub get"
echo "  2. cd ios && pod install && cd .."
echo "  3. flutter run"
echo "  4. Replace REPLACE_ME_WITH_RELEASE_KEY_SHA256_FINGERPRINT in"
echo "     android/app/src/main/res/values/assetlinks.json (and redeploy"
echo "     to apps/web/public/.well-known/assetlinks.json) once you have"
echo "     generated the upload keystore — see android/key.properties.example"
