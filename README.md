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

## Layout

- `shared/schemas/db.ts`: Zod schemas for every stored row and the JSON backup.
- `shared/utils/scheduler.ts`: the only file that touches ts-fsrs (FSRS-6 defaults).
- `shared/utils/answer.ts`: answer checking. A dropped `-s`/`-ed` is always wrong and logged as a `final-sound` mistake, never forgiven as a typo.
- `app/data/repository.ts`: storage interface. `app/data/dexie.ts` implements it for the web; the native app will add SQLite.

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
