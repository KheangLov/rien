#!/bin/zsh
# Reinstalls Rien when the free 7-day install is more than 6 days old and the
# iPhone is reachable (same Wi-Fi, unlocked). Otherwise it does nothing, so it
# is safe to run often, by hand or from scripts/rien-renew.plist.
set -uo pipefail
cd "${0:A:h}/.."

STAMP="$HOME/.rien-last-install"
NOW=$(date +%s)
LAST=$(cat "$STAMP" 2>/dev/null || echo 0)

echo "$(date '+%F %T') last install $(( (NOW - LAST) / 86400 )) day(s) ago"
if (( NOW - LAST < 6 * 86400 )); then
  exit 0
fi

if ! xcrun devicectl list devices 2>/dev/null | grep "physical" | grep -vq "unavailable"; then
  echo "iPhone not reachable; try again later"
  exit 0
fi

echo "Renewing the install"
scripts/install-iphone.sh 2>&1 | grep -E "iPhone:|Rien is installed|error|No paired" || true
