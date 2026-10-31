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
