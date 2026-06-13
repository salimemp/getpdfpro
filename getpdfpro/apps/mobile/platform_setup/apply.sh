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

echo "==> Copying android/app/src/main/AndroidManifest.xml"
cp "$SCRIPT_DIR/android/AndroidManifest.xml" android/app/src/main/AndroidManifest.xml

echo ""
echo "Done. Verify the changes look right:"
echo "  diff <(git show HEAD:ios/Runner/Info.plist) ios/Runner/Info.plist"
echo "  diff <(git show HEAD:android/app/src/main/AndroidManifest.xml) android/app/src/main/AndroidManifest.xml"
echo ""
echo "Next steps:"
echo "  1. flutter pub get"
echo "  2. cd ios && pod install && cd .."
echo "  3. flutter run"
