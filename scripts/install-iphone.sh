#!/bin/zsh
# Builds Rien and installs it on the paired iPhone (cable or same Wi-Fi).
# Free Apple ID installs stop opening after 7 days; run this again to renew.
# The phone must be unlocked. Words and progress on the phone are kept.
#   scripts/install-iphone.sh           Release build (optimised, no Web Inspector)
#   scripts/install-iphone.sh --debug   Debug build
# Both use the free-team app ID io.github.kheanglov.rien.dev, so either installs
# over the other with her data kept. The real ID (no .dev) stays free for a
# paid App Store/TestFlight release later.
set -euo pipefail
cd "${0:A:h}/.."

CONFIG=Release
[[ "${1:-}" == "--debug" ]] && CONFIG=Debug

source ~/.nvm/nvm.sh >/dev/null 2>&1 || true
nvm use >/dev/null

# A paired iPhone that is reachable right now (not "unavailable": locked, asleep or off the Wi-Fi).
DEVICE=${RIEN_DEVICE:-$(xcrun devicectl list devices 2>/dev/null | awk '/physical/ && /iPhone/ && !/unavailable/ { for (i = 1; i <= NF; i++) if ($i ~ /^[0-9A-F]{8}-[0-9A-F]{16}$/) { print $i; exit } }')}
if [[ -z "$DEVICE" ]]; then
  echo "iPhone not reachable. Unlock it, keep it on the same Wi-Fi as this Mac, and try again." >&2
  exit 1
fi
echo "iPhone: $DEVICE"

DERIVED=${TMPDIR:-/tmp}/rien-device-build
pnpm build:ios
LOG="$DERIVED.log"
echo "Building the $CONFIG app for the iPhone (log: $LOG)…"
# Quiet mode printed warnings in plugin code as "error" lines, so keep the
# full log in a file and show its end only if the build really fails.
if ! xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration $CONFIG RIEN_ID_SUFFIX=.dev \
  -destination "id=$DEVICE" -derivedDataPath "$DERIVED" \
  -allowProvisioningUpdates -allowProvisioningDeviceRegistration build > "$LOG" 2>&1; then
  grep -E "error:|BUILD FAILED" "$LOG" | tail -20 >&2
  exit 1
fi
xcrun devicectl device install app --device "$DEVICE" "$DERIVED/Build/Products/$CONFIG-iphoneos/App.app"
xcrun devicectl device process launch --device "$DEVICE" io.github.kheanglov.rien.dev
date +%s > "$HOME/.rien-last-install"
echo "Rien is installed and open. It works for 7 days from now."
