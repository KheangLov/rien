# Project

**Purpose:** facts about this codebase: stack, commands, structure, architecture, data flow, integrations, tests. **Read when:** a task needs a fact not in its task file; read only the matching section.

## Summary
Rien is a private study tool for one learner (ACE Cambodia GEP levels 4-12: English File Pre-Intermediate, Intermediate, Upper-Intermediate 4e and Ready for IELTS). It has spaced-repetition word recall, grammar and sound games, IELTS practice, a daily session, streaks, and a fish tank that rewards practice. It is client-only: no accounts, no server, data on the device (`README.md:4`). Web build on Vercel (auto-deploys from `main`); native builds through Capacitor (`capacitor.config.ts`, app ID `io.github.kheanglov.rien`).

## Stack
- pnpm 11.28.10 (`package.json:6`), Node `^24.22.1` or `>=26.12.1` (`package.json:8`), `.nvmrc` 26.13.0; no workspaces (`pnpm-workspace.yaml` holds settings only).
- Nuxt 4.6.2, `ssr: false` (`nuxt.config.ts:14`), Vue 3.5, vue-router 5; `@vite-pwa/nuxt` for the PWA.
- UI: `@squirkle-ui/*` 0.1.2 (core, ui, nuxt, charts), prefix `Sq`; Solar icons (Iconify subset).
- Data: Dexie 4.4.7 (IndexedDB, web), `@capacitor-community/sqlite` (native); Zod 4 schemas.
- Learning: ts-fsrs 5.4.2 (pinned), TensorFlow.js 4.22.0 (pinned, worker only).
- Native: Capacitor 8.5.3 (iOS, Android) with sqlite, filesystem, haptics, keyboard, local-notifications, share, splash-screen, status-bar plugins.
- Tooling: TypeScript 6.0.3 (TS 7 blocked, see Dependencies), Vitest 5.0.5 with fake-indexeddb.

## Commands (verified against package scripts)
| Command | Runs |
| --- | --- |
| `pnpm dev` | `nuxt dev` |
| `pnpm generate` / `pnpm build` | `nuxt generate` → `.output/public` |
| `pnpm preview` | `nuxt preview` |
| `pnpm test` | `vitest run`; scoped: `pnpm vitest run tests/<name>.test.ts`, or `-t "<name>"` |
| `pnpm typecheck` | `nuxt typecheck` |
| `pnpm audit` | `pnpm audit --audit-level high` |
| `pnpm build:e2e` | `RIEN_E2E=1 nuxt generate` (in-app e2e runner) |
| `pnpm build:ios` / `pnpm build:ios:e2e` | `RIEN_NATIVE=1 nuxt generate` + `cap sync ios` (e2e variant adds `RIEN_E2E=1`) |
| `pnpm open:ios` | `cap open ios` |
| `pnpm build:android` | `RIEN_NATIVE=1 nuxt generate` + `cap sync android` |
| `pnpm apk` / `pnpm apk:dev` | `scripts/build-apk.sh` (signed release) / `--debug` |
| `pnpm install:iphone` / `pnpm renew:iphone` | `scripts/install-iphone.sh` / `scripts/renew-iphone.sh` |
| `pnpm icons` | `node scripts/build-icons.mjs` (Solar subset) |

No lint, format or codegen scripts exist.

## Structure (important paths only)
| Path | Purpose | Notes / risks |
| --- | --- | --- |
| `app/pages/` | routes: tabs (`index`, `words`, `tank`, `progress`, `settings`), `session`, `games/[id]`, `ielts/*` | tab list also in `app/middleware/transition.global.ts` |
| `app/components/games/` | one component per activity; `registry.ts` lists them | |
| `app/components/ios/` | native-style controls (IosGroup, IosRow, IosSheet) | file names must start with `Ios` |
| `app/components/items/` | answer items (FixItItem, SoundItem, WordItem) | must be imported explicitly; Nuxt auto-import fails for them |
| `app/composables/` | state and behaviour (`useDb`, `useLiveQuery`, `useLearner`, `useSpeech`) | no Pinia |
| `app/data/` | storage: `repository.ts` interface, `dexie.ts` (web), `sql.ts` + `native.ts` (SQLite) | G12 |
| `app/plugins/` | client plugins: appearance, backup, icons, learner, quiet, shortcuts, splash, squircles | |
| `app/workers/` | `learner.worker.ts` (skill model, TF.js), `restore.worker.ts` (backup import) | |
| `shared/utils/` | pure logic: scheduler (only ts-fsrs user), answer checking, mastery, streak, tank | unit-tested |
| `shared/ml/` | MLP features, training, forward pass | `forward.ts` runs on the main thread without TF.js |
| `shared/schemas/` | Zod schemas: `db.ts` (tables, settings), `pack.ts` (content packs) | |
| `public/packs/` | 52 original content packs + `index.json` | original writing only (P-2) |
| `public/sw-look.js` | per-user PWA manifest via the service worker | G12 |
| `e2e/runner.client.ts` | in-app e2e runner, loaded only when `RIEN_E2E=1` | |
| `tests/` | Vitest unit and storage tests | |
| `android/`, `ios/` | Capacitor native projects; Java/Swift plugins | signing outside the repo |
| `scripts/` | APK build, iPhone install/renew, icons, brand assets | |

## Architecture and boundaries
- Client-only SPA: no backend, no auth, no network calls except same-origin pack fetches (`app/composables/usePacks.ts:8`).
- Storage boundary: everything goes through the `StudyRepository` interface (`app/data/repository.ts:6`); `useDb()` (`app/composables/useDb.ts:10`) picks Dexie on the web or SQLite on native (`Capacitor.isNativePlatform()`), the SQLite code lazy-loaded.
- Pure logic lives in `shared/utils/` and is unit-tested; `shared/utils/scheduler.ts` is the only file that touches ts-fsrs (`README.md:94`).
- Heavy work runs in Web Workers: skill model and TF.js training (`app/workers/learner.worker.ts`), backup restore (`app/workers/restore.worker.ts`). TF.js ships only in worker chunks.
- Native features use Capacitor plugins, including in-app ones registered with `registerPlugin` (`app/utils/rienSpeech.ts:30`, `app/utils/rienLook.ts`), always behind `Capacitor.isNativePlatform()`.
- Build flags: `RIEN_NATIVE` (no PWA), `RIEN_E2E` (e2e runner), `RIEN_PROFILE` (profiling) in `nuxt.config.ts:4-9`.

## Data flow
- UI: pages and game components (`app/pages/index.vue:12-13`).
- State: composables with refs and `useLiveQuery` (`app/composables/useLiveQuery.ts`).
- Storage: `useDb()` → `StudyRepository` → Dexie (`app/data/dexie.ts`) or SQLite (`app/data/sql.ts`); every row Zod-parsed on read in SQLite.
- Learning: answers logged as attempts → learner worker → skill model / ML weights in settings.
- Backup: export/import JSON (`shared/utils/backups.ts`, `app/composables/useBackupFile.ts`), restore in a worker.

## Features
- Daily session (`app/pages/session.vue`) built from due cards and weak skills.
- Games (`app/components/games/registry.ts`): Word Recall, Fix It, Sound Hunter, File Boss, Couple Talk, Say It, Sentence Builder, Gap Radio, Listen Pick, Picture Match, Speed Round, quick choices.
- Words: add words (`app/pages/add-words.vue`), word list, FSRS scheduling.
- IELTS practice (`app/pages/ielts/index.vue`): speaking, writing (drafts saved), reading, listening, band estimate.
- Progress and streaks (`app/pages/progress.vue`), fish tank (`app/pages/tank.vue`), slips (`app/pages/slips.vue`).
- Settings: appearance, her colour, Liquid Glass, motion, reminders, level/book, backups (`app/pages/settings.vue`).
- Android long-press shortcuts and PWA shortcuts (`app/plugins/shortcuts.client.ts`).

## Integrations and env var names
- No external APIs, analytics, CDNs or web fonts. Iconify API is off (offline).
- Speech: on-device by default; an opt-in setting lets iOS use Apple's online recognition (`shared/schemas/db.ts:222`, `app/composables/useListen.ts:103`).
- No `.env.example`. Env var names (build only): `RIEN_NATIVE`, `RIEN_E2E`, `RIEN_PROFILE` (`nuxt.config.ts`); scripts: `RIEN_DEVICE`, `RIEN_ANDROID_SIGNING`, `RIEN_ANDROID`, `RIEN_ID_SUFFIX`.
- Deploy: Vercel GitHub app builds `main` (no config file in the repo).

## Dependencies to know (purpose, constraints)
- `ts-fsrs` pinned 5.4.2: 6.x defaults to FSRS-7 and was too new for the release-age wait.
- `typescript` 6: vue-tsc fails on TS 7; `.github/dependabot.yml` ignores `>=7`.
- TensorFlow.js packages pinned 4.22.0; workers only.
- `@squirkle-ui/*`: authored by the repo owner; gaps are fixed upstream (drafts in `docs/squirkle-upstream.md`), excluded from the release-age wait.
- `pnpm-workspace.yaml`: `minimumReleaseAge` 7 days, `engineStrict`, `allowBuilds` limited to esbuild and @parcel/watcher, node-forge override `>=1.4.1`.
- Official fsrs-browser is not usable (needs SharedArrayBuffer); `shared/utils/fsrsFit.ts` fits first stability instead.

## Testing
- Vitest, node environment, `tests/**/*.test.ts` (`vitest.config.ts`), fake-indexeddb; storage tests run against both IndexedDB and SQLite (`README.md:21`).
- Scoped: `pnpm vitest run tests/scheduler.test.ts`; by name: `-t "<name>"`.
- E2E: `pnpm build:e2e`, serve `.output/public` on port 4199 and open in Chrome with a fresh profile; the runner logs `[e2e] PASS/FAIL` lines and ends with `[e2e] DONE pass=.. fail=..`. iOS: `pnpm build:ios:e2e`, launch in the simulator with `--console-pty`.
- The runner fails on anything sticking out of a card; check web and iPhone layouts separately (Chrome draws squircles natively).
- CI (`.github/workflows/ci.yml`): install (frozen), audit, test, typecheck, generate. No native builds in CI.

## Performance notes (evidence only)
- Profiling build: `RIEN_PROFILE=1` (`nuxt.config.ts:9`), measured with long-animation-frame entries at CPU 4x slowdown.
- Skill model and ML training run in `app/workers/learner.worker.ts` to keep the main thread free; the main thread uses `shared/ml/forward.ts` only.
- Offline install depends on precaching only `index.html`; precaching other routes broke the service worker install.
