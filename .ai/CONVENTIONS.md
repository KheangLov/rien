# Conventions

**Purpose:** how code is written here, with one real example path per rule, and the review checklist. **Read when:** writing or reviewing code.

## Code
- Validation: Zod at every boundary: packs (`shared/schemas/pack.ts`, parsed in `app/composables/usePacks.ts:11`), DB rows and backups (`shared/schemas/db.ts`, `app/data/sql.ts:88`).
- Errors: named `Error` subclasses (`DuplicateWordError`, `app/data/repository.ts:63`).
- State: composables with refs, no Pinia; live data via `useLiveQuery(() => db.countCards(), 0)` (`app/pages/index.vue:13`).
- Data access: always through `useDb()` and the `StudyRepository` interface; never Dexie or SQL from a component.
- Native: `registerPlugin<Iface>('Name')` behind `Capacitor.isNativePlatform()` (`app/utils/rienSpeech.ts:30`).
- Forms: native inputs with directives (`app/directives/inputAttrs.ts`, `app/directives/plainInput.ts`); example `app/pages/add-words.vue`.
- Pure logic in `shared/utils/` with a matching test in `tests/`.

## Naming (G9)
- Components PascalCase `.vue`; nested folders get Nuxt prefixes, so `app/components/ios/` files start with `Ios`.
- Composables `useXxx.ts` (`app/composables/useSpeech.ts`); client plugins `*.client.ts`; pages kebab-case (`app/pages/add-words.vue`).
- `shared/utils/` files lower camelCase (`shared/utils/fsrsFit.ts`); tests `tests/<name>.test.ts`.
- User-facing text says "her" for the learner and plain words; English UI strings are inline (no i18n).

## Tests
- Unit tests import pure functions from `shared/utils/` (`tests/scheduler.test.ts`).
- Storage tests run the same suite against Dexie and SQLite (`tests/repository.test.ts`).
- New screens or games get an e2e step in `e2e/runner.client.ts`.

## Commits
- Short sentence-case subject that says what changed, no type prefix (`No pure white: soft whites throughout`).
- Work happens on a feature branch, merged into `main` with `Merge branch '<name>'`, then `main` is pushed (Vercel deploys it).
- No AI attribution (G10-1, chosen 2026-11-03); older commits carry Co-Authored-By trailers.

## Anti-patterns seen here
- Auto-importing components from `app/components/items/` (silently fails to resolve).
- `position: fixed` inside blur or transform ancestors (use `app/components/ActionBar.vue`, which teleports to body).
- `overflow: hidden` on squircles: clips on iPhone, looks fine in Chrome.
- Overriding `.sq-surface` with a selector no more specific than Squirkle's (its CSS loads after `app/assets/css/main.css`).
- Borders on unselected segmented options (the user dislikes them).

## Review checklist (Phase 7 and code-reviewer)
- Prompt adherence: every Required Change done, nothing extra; diff only in the task's files.
- Correctness: the input, state or ordering that breaks it; error paths; edge cases from the task.
- Guardrails: no secrets, no weakened checks, no G4 action without confirmation, writer scope respected.
- Security: the SECURITY sections for the touched layers; G12 paths get the full pass.
- Declarations (G9): reuse checked, no duplicates or unused code, narrowest types.
- Tests: assert behavior, cover the edge and error cases, nothing skipped.
- UI: tokens and existing components only (DS-1, DS-2), all listed states, plain inline English strings (no i18n).
- Git: no AI attribution; message format per Commits.
- Project rules:
  - P-1: Never pure white (`#fff` / `#ffffff`); soft whites `#f8fafc` / `#fcfcfd` (`nuxt.config.ts`, `app/assets/css/main.css:153`).
  - P-2: Content packs are original writing, never copied from English File; aligned only to each book's grammar list. Read every corrected sentence and check that no distractor is also correct English.
  - P-3: Sound never outlives its screen: stop speech on route change, background, sheet close and unmount (`app/plugins/quiet.client.ts`).
  - P-4: The app must work offline: no Iconify API, no web fonts, no CDN (`nuxt.config.ts`).
  - P-5: The bundle ID `io.github.kheanglov.rien` never changes (`README.md:41`).
  - P-6: A dropped `-s`/`-ed` is always wrong (a final-sound mistake), never forgiven as a typo (`README.md:95`).
  - P-7: Fish health is never tied to answer accuracy, only to practice.
