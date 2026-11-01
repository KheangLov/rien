#!/bin/zsh
# Builds the Rien Android app as an APK file and puts it on the Desktop.
# Send Rien.apk to the phone any way you like (Telegram, Google Drive, a cable)
# and open it there; Android asks once to allow installing apps from that app.
# If an Android phone with USB or wireless debugging is connected, it is
# installed there straight away. Words and progress on the phone are kept.
set -euo pipefail
cd "${0:A:h}/.."

source ~/.nvm/nvm.sh >/dev/null 2>&1 || true
nvm use >/dev/null

# Homebrew's JDK 21 and Android SDK, unless already set.
export JAVA_HOME=${JAVA_HOME:-$(brew --prefix openjdk@21)/libexec/openjdk.jdk/Contents/Home}
export ANDROID_HOME=${ANDROID_HOME:-$HOME/Library/Android/sdk}
export PATH="$ANDROID_HOME/platform-tools:$PATH"

pnpm build:android
LOG=${TMPDIR:-/tmp}/rien-android-build.log
echo "Building the APK (log: $LOG)…"
if ! (cd android && ./gradlew assembleDebug > "$LOG" 2>&1); then
  tail -30 "$LOG" >&2
  exit 1
fi

APK=android/app/build/outputs/apk/debug/app-debug.apk
cp "$APK" ~/Desktop/Rien.apk
echo "APK: ~/Desktop/Rien.apk ($(du -h "$APK" | cut -f1))"

# A phone connected by cable or wireless debugging (one paired phone can show
# up twice over Wi-Fi, so take the first).
DEVICE=${RIEN_ANDROID:-$(adb devices 2>/dev/null | awk 'NR > 1 && $2 == "device" { print $1; exit }')}
if [[ -n "$DEVICE" ]]; then
  adb -s "$DEVICE" install -r "$APK"
  adb -s "$DEVICE" shell monkey -p io.github.kheanglov.rien.dev -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1 || true
  echo "Installed on the connected phone ($DEVICE)."
else
  echo "No phone connected; send the APK to it instead."
fi
