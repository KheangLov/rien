#!/bin/zsh
# Builds Rien and installs it on the paired iPhone (cable or same Wi-Fi).
# Free Apple ID installs stop opening after 7 days; run this again to renew.
# The phone must be unlocked. Words and progress on the phone are kept.
set -euo pipefail
cd "${0:A:h}/.."

source ~/.nvm/nvm.sh >/dev/null 2>&1 || true
nvm use >/dev/null

DEVICE=${RIEN_DEVICE:-$(xcrun devicectl list devices 2>/dev/null | awk '/physical/ && /iPhone/ { for (i = 1; i <= NF; i++) if ($i ~ /^[0-9A-F]{8}-[0-9A-F]{16}$/) { print $i; exit } }')}
if [[ -z "$DEVICE" ]]; then
  echo "No paired iPhone found. Unlock it and keep it on the same Wi-Fi as this Mac." >&2
  exit 1
fi
echo "iPhone: $DEVICE"

DERIVED=${TMPDIR:-/tmp}/rien-device-build
pnpm build:ios
LOG="$DERIVED.log"
echo "Building for the iPhone (log: $LOG)…"
# Quiet mode printed warnings in plugin code as "error" lines, so keep the
# full log in a file and show its end only if the build really fails.
if ! xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -destination "id=$DEVICE" -derivedDataPath "$DERIVED" \
  -allowProvisioningUpdates -allowProvisioningDeviceRegistration build > "$LOG" 2>&1; then
  grep -E "error:|BUILD FAILED" "$LOG" | tail -20 >&2
  exit 1
fi
xcrun devicectl device install app --device "$DEVICE" "$DERIVED/Build/Products/Debug-iphoneos/App.app"
xcrun devicectl device process launch --device "$DEVICE" io.github.kheanglov.rien.dev
echo "Rien is installed and open. It works for 7 days from now."
