#!/bin/zsh
# Builds the Rien Android app as an APK file and puts it on the Desktop.
#   scripts/build-apk.sh            release: ~/Desktop/Rien.apk (io.github.kheanglov.rien)
#   scripts/build-apk.sh --debug    debug:   ~/Desktop/Rien-dev.apk (io.github.kheanglov.rien.dev)
# Release builds are signed with the key in ~/.config/rien (see README); without
# it the release build stops rather than produce an unsigned APK.
# Send the APK to the phone any way you like (Telegram, Google Drive, a cable)
# and open it there; Android asks once to allow installing apps from that app.
# If an Android phone with USB or wireless debugging is connected, it is
# installed there straight away. Words and progress on the phone are kept.
set -euo pipefail
cd "${0:A:h}/.."

MODE=release
[[ "${1:-}" == "--debug" ]] && MODE=debug

source ~/.nvm/nvm.sh >/dev/null 2>&1 || true
nvm use >/dev/null

# Homebrew's JDK 21 and Android SDK, unless already set.
export JAVA_HOME=${JAVA_HOME:-$(brew --prefix openjdk@21)/libexec/openjdk.jdk/Contents/Home}
export ANDROID_HOME=${ANDROID_HOME:-$HOME/Library/Android/sdk}
export PATH="$ANDROID_HOME/platform-tools:$PATH"

SIGNING=${RIEN_ANDROID_SIGNING:-$HOME/.config/rien/android-release.properties}
if [[ $MODE == release && ! -f $SIGNING ]]; then
  echo "No release key settings at $SIGNING. Restore the key from your backup, or use --debug." >&2
  exit 1
fi

# Each build gets a higher version code (commit count), so updates install over older ones.
VERSION_CODE=$(git rev-list --count HEAD)
VERSION_NAME=$(node -p "require('./package.json').version")

pnpm build:android
LOG=${TMPDIR:-/tmp}/rien-android-build.log
TASK=assemble${(C)MODE}
echo "Building the $MODE APK $VERSION_NAME ($VERSION_CODE) (log: $LOG)…"
if ! (cd android && ./gradlew $TASK -PrienVersionCode=$VERSION_CODE -PrienVersionName=$VERSION_NAME > "$LOG" 2>&1); then
  tail -30 "$LOG" >&2
  exit 1
fi

if [[ $MODE == release ]]; then
  APK=android/app/build/outputs/apk/release/app-release.apk
  OUT=~/Desktop/Rien.apk
  APP_ID=io.github.kheanglov.rien
else
  APK=android/app/build/outputs/apk/debug/app-debug.apk
  OUT=~/Desktop/Rien-dev.apk
  APP_ID=io.github.kheanglov.rien.dev
fi
cp "$APK" $OUT
echo "APK: $OUT ($(du -h "$APK" | cut -f1))"

# A phone connected by cable or wireless debugging (one paired phone can show
# up twice over Wi-Fi, so take the first).
DEVICE=${RIEN_ANDROID:-$(adb devices 2>/dev/null | awk 'NR > 1 && $2 == "device" { print $1; exit }')}
if [[ -n "$DEVICE" ]]; then
  adb -s "$DEVICE" install -r "$APK"
  adb -s "$DEVICE" shell monkey -p $APP_ID -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1 || true
  echo "Installed on the connected phone ($DEVICE)."
else
  echo "No phone connected; send the APK to it instead."
fi
