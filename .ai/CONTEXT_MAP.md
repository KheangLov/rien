# Context map

**Purpose:** which files and sections to read for which task; read this first, every task. **Read when:** always.

- **Prompt version:** CONTEXT-ENGINEER-PROMPT v2
- **Last synced:** `77b4be5454c5c520738d16de01bc06efab9a2a3b` (2026-11-03)

## Routing
| Task type | Read first | Read if needed |
| --- | --- | --- |
| Implement a handed-off task (Claude) | the task file only | its `files_to_read`; `.ai/TASK_CONTRACT.md` Import Check |
| Write a task file | `.ai/TASK_CONTRACT.md`, `.ai/WORKFLOW.md` (Modes, Routing) | rows below for the task type |
| Change on a G12 path | `.ai/SECURITY.md` (sections for the layer) | `.ai/GUARDRAILS.md` G12 |
| UI from Figma | `.ai/DESIGN_SYSTEM.md` (Figma section) | `.ai/CONVENTIONS.md` |
| UI change | `.ai/DESIGN_SYSTEM.md` | `.ai/CONVENTIONS.md` |
| Commit or git question | `.ai/GUARDRAILS.md` G10 | `.ai/CONVENTIONS.md` (commits) |
| Refresh docs | this file (Last synced) | the files the changed paths map to |
| New or changed game / activity | `.ai/PROJECT.md` (Features), `app/components/games/registry.ts` | `.ai/DESIGN_SYSTEM.md`, `app/composables/useActivityRecorder.ts` |
| Study content (packs, books, grammar) | `.ai/CONVENTIONS.md` (Project rules P-2), `shared/schemas/pack.ts` | `public/packs/index.json`, `shared/schemas/db.ts` |
| Storage, schema or backups | `.ai/SECURITY.md` (G12, S4), `app/data/repository.ts` | `app/data/dexie.ts`, `app/data/sql.ts`, `shared/utils/backups.ts` |
| Scheduling, mastery, ML | `.ai/PROJECT.md` (Architecture) | `shared/utils/scheduler.ts`, `shared/utils/mastery.ts`, `shared/ml/train.ts` |
| Native iOS/Android (plugins, builds, installs) | `.ai/PROJECT.md` (Commands, Structure), `README.md` | `app/utils/rienSpeech.ts`, `scripts/build-apk.sh`, `capacitor.config.ts` |
| Speech, sound, mic | `.ai/CONVENTIONS.md` (P-3), `app/composables/useSpeech.ts` | `app/composables/useListen.ts`, `app/plugins/quiet.client.ts` |
| PWA, offline, service worker | `nuxt.config.ts` (pwa block) | `public/sw-look.js`, `.ai/SECURITY.md` G12 |
| Dependency bump | `pnpm-workspace.yaml`, `.ai/PROJECT.md` (Dependencies) | `.github/dependabot.yml`, `.ai/GUARDRAILS.md` G4 |

## Reserved approval words (work → the only word that approves it; default `go`)
none (every change is approved with `go`)

## Existing kit and records
- No earlier agent kit. Decision log: `.ai/DECISIONS.md` (created 2026-11-03); it outranks every `.ai/` file but GUARDRAILS and SECURITY.
- Handoff and progress notes: `README.md` (Checks, iPhone, Android sections); Squirkle upstream drafts: `docs/squirkle-upstream.md`.

## Merged or renamed files
- Kit edit: Never rule 9 in `AGENTS.md` is G6-DATA (on-device data has no server copy) instead of G6-AC, which has nothing to check in a client-only app; G6-AC stays in `.ai/GUARDRAILS.md` for any future backend.

## Known drift (code vs rules, open conflicts)
- Due 2026-11-03 (`pnpm-workspace.yaml:9-11`): remove the temporary node-forge release-age exclusion and update Nuxt to 4.6.3. Open; needs the user's go (G4-2).
- No lint or format script and no formatter config exist, while the kit's checklist assumes one; the setup formatter step was skipped.
- `android/app/src/main/AndroidManifest.xml:5` sets `allowBackup="true"`: system backups can copy her SQLite data. Undecided.
- Backup restore (`app/data/dexie.ts:252`) replaces all tables after Zod validation with no size cap. Undecided.

## Glossary
- **behavior change:** any change in output, state, API, validation or side effect a user, caller or test can observe.
- **security-sensitive path:** a path listed under G12 in `.ai/SECURITY.md`.
- **production:** any environment with real users or real data.
- **new dependency:** a package not in the lockfile, or a major-version bump.
- **done:** every acceptance criterion proven by a test name or command output.
