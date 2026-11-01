# Rien (រៀន)

Daily English practice for ACE General English, Level 6 to Level 12.
Client-only Nuxt 4 PWA with Squirkle UI. Everything is stored on the device.

## Setup

```bash
nvm use            # Node 26.13.0 (see .nvmrc); minimum ^24.22.1 || >=26.12.1
pnpm install       # pnpm 11; install scripts and fresh releases are restricted in pnpm-workspace.yaml
pnpm dev           # http://localhost:3000
pnpm generate      # static build in .output/public
pnpm preview       # serve the static build
pnpm test          # Vitest: scheduler, answer checking, Dexie repository
pnpm typecheck     # vue-tsc via nuxt typecheck
pnpm audit         # fails on high-severity advisories
```

## Checks

- `pnpm test`: unit tests, with every storage test run against both IndexedDB and SQLite.
- `pnpm build:e2e`, then open the build: `e2e/runner.client.ts` plays every game through the
  real screens and logs `[e2e] PASS/FAIL` lines, ending with `[e2e] DONE`.
- `pnpm build:ios:e2e`: the same run inside the iOS app (launch it with
  `xcrun simctl launch --console-pty <device> io.github.kheanglov.rien` to read the log).
- CI (`.github/workflows/ci.yml`) runs install from the lockfile, audit, tests, type check
  and build once the repository is on GitHub. Dependabot updates weekly with a 7-day wait.

## iPhone app (Capacitor)

The same build wrapped as a native app, with SQLite storage instead of IndexedDB
(iOS may clear web storage when space runs low).

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer   # once
sudo xcodebuild -license accept && sudo xcodebuild -runFirstLaunch # once
pnpm build:ios     # static build without the service worker, then cap sync
pnpm open:ios      # open in Xcode; pick a team under Signing & Capabilities
```

- Bundle ID: `io.github.kheanglov.rien` (confirmed; in `capacitor.config.ts` and the Xcode
  project). Apple does not allow changing it once the App Store Connect record exists.
- Moving her data: Settings → Save backup in the web app, then Settings → Restore in the
  native app.
- Free Apple ID install (no paid program): Debug builds are signed with the Personal Team
  under `io.github.kheanglov.rien.dev`. `pnpm install:iphone` builds, installs and opens it
  on the paired iPhone, over Wi-Fi once paired. Free installs stop opening after 7 days;
  run it again to renew. Developer Mode must be on (Settings → Privacy & Security).
- `pnpm renew:iphone` reinstalls only when the install is over 6 days old. To run that
  automatically every 3 hours (optional, your choice):
  `cp scripts/rien-renew.plist ~/Library/LaunchAgents/ && launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/rien-renew.plist`.
  To turn it off: `launchctl bootout gui/$(id -u)/io.github.kheanglov.rien.renew && rm ~/Library/LaunchAgents/rien-renew.plist`.

## Android app (Capacitor)

Same build and SQLite storage as the iPhone app. Needs JDK 21 and the Android SDK
(no Android Studio):

```bash
brew install openjdk@21 && brew install --cask android-commandlinetools   # once
export JAVA_HOME=$(brew --prefix openjdk@21)/libexec/openjdk.jdk/Contents/Home
sdkmanager --sdk_root=$HOME/Library/Android/sdk --licenses                  # once
sdkmanager --sdk_root=$HOME/Library/Android/sdk "platform-tools" "platforms;android-36" "build-tools;36.0.0"
pnpm apk           # release ~/Desktop/Rien.apk; installs it too if a phone is connected with debugging on
```

- `pnpm apk` builds the **release** app (`io.github.kheanglov.rien`, signed, not debuggable) as
  `~/Desktop/Rien.apk`. `pnpm apk:dev` builds the debug app (`io.github.kheanglov.rien.dev`) as
  `~/Desktop/Rien-dev.apk`; the two install side by side with separate data.
- Install without a cable or developer options: send `Rien.apk` to the phone (Telegram,
  Google Drive, email), tap it, and allow installing apps from that app once. To update,
  install a newer `Rien.apk` the same way; words and progress are kept. It never expires.
  Developer options and wireless debugging can stay off; they are only needed for
  `pnpm apk` to install straight onto the phone.
- Release signing key: `~/.config/rien/rien-release.jks` with its settings in
  `~/.config/rien/android-release.properties` (password also in the macOS Keychain as
  "Rien Android release key"). Never commit them. **Back both files up** (password manager or
  an encrypted drive): updates only install over the app if they are signed with this key.
  Lost key = uninstall, reinstall, and restore her words from a backup.
- Version: `versionName` comes from `package.json`, `versionCode` from the number of commits,
  so every build installs over the last one.
- Say It and reading aloud use Android's own speech services
  (`android/app/src/main/java/io/github/kheanglov/rien/RienSpeechPlugin.java`): Android's
  web view has no speechSynthesis. Android gives whole-sentence readings only (no per-word
  confidence) and no playback of her recording.

## Layout

- `shared/schemas/db.ts`: Zod schemas for every stored row and the JSON backup.
- `shared/utils/scheduler.ts`: the only file that touches ts-fsrs (FSRS-6 defaults).
- `shared/utils/answer.ts`: answer checking. A dropped `-s`/`-ed` is always wrong and logged as a `final-sound` mistake, never forgiven as a typo.
- `app/data/repository.ts`: storage interface. `app/data/dexie.ts` implements it for the web,
  `app/data/sql.ts` for SQLite (the app runs it on the Capacitor plugin, the tests on `node:sqlite`).

## iPhone check (plan week 4)

1. Deploy `.output/public` to any static HTTPS host.
2. On her iPhone, open it in Safari, then Share → Add to Home Screen.
3. Open it once from the Home Screen while online and wait a few seconds,
   then turn on Airplane Mode, close the app fully and open it again.
4. With Airplane Mode still on, open Word Recall, Fix It, Final Sound Hunter,
   File Boss, Couple Talk, Progress and Settings. Each should load.
5. Final Sound Hunter: are the iPhone voice's -s and -ed endings clear enough?
   If not, the plan's fallback is recorded audio for the core words.
6. Settings → Speech test, once in Safari and once from the Home Screen.
   Copy both reports.
7. Settings → Save backup, and check the file lands in Files.

## Credits

- Icons: [Solar](https://www.figma.com/community/file/1166831539721848736) by 480 Design, licensed
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), bundled through `@iconify-json/solar`
  (`pnpm icons` rebuilds `app/assets/icons/solar.json`). The fish icon is drawn for Rien in Solar's style.
