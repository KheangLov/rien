# Security

**Purpose:** the security rules active for this stack, the sensitive paths, and what enforces them. **Read when:** any code change (only the sections for the layers it touches); always for G12 paths.

- **Profile:** standard (`standard` = ASVS 5.0 L2; `high` = L3, where [HIGH] rules are mandatory and ARCH security rules take their strictest variant).
- **Standards checked:** 2026-11-03 — OWASP Top 10:2025, ASVS 5.0, API Security Top 10, PCI DSS 4.0.1.
- **Active sections:** S1, S2 (frontend), S4 (on-device database), S5. S3 does not apply: there is no backend or API.

## G12 Sensitive paths
- Storage and migrations: `app/data/dexie.ts` (versions), `app/data/sql.ts` (migrations, raw SQL), `app/data/native.ts`, `app/data/repository.ts`, `shared/schemas/db.ts`.
- Backup import and restore: `shared/utils/backups.ts`, `app/composables/useBackupFile.ts`, `app/data/backgroundRestore.ts`, `app/workers/restore.worker.ts`, `app/plugins/backup.client.ts`.
- Service worker and manifest: `public/sw-look.js`, the `pwa` block in `nuxt.config.ts`.
- Native code and permissions: `android/app/src/main/AndroidManifest.xml`, `android/app/src/main/java/io/github/kheanglov/rien/`, `ios/App/App/RienSpeechPlugin.swift`, `ios/App/App/Info.plist`.
- Signing, install and builds: `android/app/build.gradle`, `scripts/build-apk.sh`, `scripts/install-iphone.sh`, `scripts/renew-iphone.sh`, `capacitor.config.ts`.
- Supply chain and CI: `pnpm-workspace.yaml`, `package.json`, `pnpm-lock.yaml`, `.github/workflows/ci.yml`, `.github/dependabot.yml`.
- Data leaving the device: the online speech recognition setting (`app/composables/useListen.ts`).

## Trust boundaries and auth (evidence)
- No auth, accounts or server: single learner, on-device data (`README.md:4`). Nothing to authorize.
- Untrusted inputs: backup files she imports (Zod-parsed in `app/workers/restore.worker.ts`), fetched packs (same-origin, Zod-parsed in `app/composables/usePacks.ts`), typed answers, speech recognition results.
- Data egress: only Apple's online speech recognition when she turns it on (`ios/App/App/RienSpeechPlugin.swift`); Android uses system speech services.
- Secrets: the Android release keystore and its properties file live outside the repo (`android/app/build.gradle:21-31`); never read or print them.

## ARCH decisions (variant chosen, residual risk, evidence)
- Client-only storage, no encryption at rest: IndexedDB on the web, SQLite on native. Residual risk: anyone with the unlocked device or a system backup can read study data (low sensitivity). Evidence: `app/data/dexie.ts`, `app/data/sql.ts`, `android/app/src/main/AndroidManifest.xml:5` (`allowBackup`).
- Backup restore replaces all data after schema validation. Residual risk: a valid but wrong file wipes progress; no size cap. Evidence: `app/data/dexie.ts:252`.
- No CSP or security headers (static host, no config in the repo). Residual risk: low, because there are no third-party scripts and no user-generated HTML. Evidence: `nuxt.config.ts`.

## S1 Universal
- S1-1 · MUST · REVIEW · Deny by default: every route, job and query authorizes on the server; client checks are UX only.
- S1-2 · MUST · REVIEW · Every external input is schema-validated at the boundary (type, length, range, format); unknown fields rejected.
- S1-3 · MUST · REVIEW · Output is encoded for its sink with framework-safe APIs; untrusted data is never concatenated into HTML, SQL, shell, URLs or headers.
- S1-4 · MUST · REVIEW · Fail closed: clients get a generic message plus a request id, never stack traces, SQL errors, paths or versions. No empty catch.
- S1-5 · MUST · REVIEW · Log sign-ins, authorization and validation failures, admin actions and money movement with user id, time and request id; never secrets, tokens, OTPs, card data or full national ids.
- S1-6 · MUST · REVIEW · Secrets only from env or a secret manager; never in code, tests, images, bundles or logs.
- S1-7 · MUST · REVIEW · Outbound calls have timeouts; list endpoints have a max page size; bodies have a size limit.
- S1-8 · ARCH · REVIEW · Web headers: HSTS 1 year, CSP without unsafe-inline/unsafe-eval (nonces or hashes), nosniff, frame-ancestors none or an allowlist, strict-origin-when-cross-origin, minimal Permissions-Policy.

## S2 Frontend
- S2-1 · MUST · TOOL (lint) · No raw-HTML sinks with data; user HTML/Markdown/SVG only through one reviewed sanitizer helper.
- S2-2 · MUST · REVIEW · No eval, new Function, string timers or data-driven dynamic imports.
- S2-3 · MUST · REVIEW · URLs from data allow https (mailto/tel where needed) only; redirects only to an internal allowlist.
- S2-4 · ARCH · REVIEW · Auth tokens never in localStorage, sessionStorage or IndexedDB; prefer HttpOnly Secure SameSite cookies; an SPA access token lives in memory, short-lived.
- S2-5 · MUST · REVIEW · Cookie-authenticated state changes carry a CSRF token, or SameSite=Strict plus an Origin check.
- S2-6 · MUST · REVIEW · postMessage checks event.origin; never `*` as target for sensitive data; iframes sandboxed; new-tab links use noopener.
- S2-7 · MUST · REVIEW · External scripts carry SRI and are listed below with a reason; none on login or payment pages unless approved (PCI DSS 6.4.3, 11.6.1).
- S2-8 · MUST · REVIEW · Only public config reaches the client; no public source maps or debug flags in production; no sensitive data in URLs.

## S3 Backend and API
- S3-1 · MUST · REVIEW · SQL only through parameterized queries or ORM bindings; ORDER BY and column names from an allowlist; no shell with input (args arrays only).
- S3-2 · MUST · REVIEW · Each endpoint declares its permission; every object access checks ownership or tenant. Unguessable ids are not authorization.
- S3-3 · MUST · REVIEW · SSRF: user-supplied URLs only to allowlisted hosts; private, loopback, link-local and metadata addresses blocked after DNS; no redirects to disallowed hosts.
- S3-4 · MUST · REVIEW · DTOs mapped field by field; never a raw body into an ORM write.
- S3-5 · MUST · REVIEW · Paths confined to a base dir; uploads checked by content, size-limited, renamed, served with Content-Disposition and nosniff.
- S3-6 · MUST · REVIEW · Passwords: Argon2id (or bcrypt 12+, scrypt). Rate limits on login, OTP, reset, sign-up. Reset tokens single-use, short-lived, hashed.
- S3-7 · ARCH · REVIEW · Sessions: HttpOnly Secure SameSite cookies, rotated on login and privilege change, idle and absolute timeouts. JWT: pin the algorithm, verify signature, exp, iss and aud; short access tokens; rotating refresh tokens with reuse detection.
- S3-8 · MUST · REVIEW · CORS: explicit allowlist; never `*` with credentials; never reflect Origin.
- S3-9 · MUST · REVIEW · Money: integer minor units or decimals; the server recomputes totals; idempotency keys on payments; balance changes in one transaction with row locks or a conditional update.
- S3-10 · MUST · REVIEW · Webhooks: HMAC verified with a constant-time compare, timestamp window, idempotent processing.
- S3-11 · MUST · REVIEW · No native deserialization of untrusted data; no custom crypto (AES-256-GCM or ChaCha20-Poly1305, CSPRNG tokens, constant-time compares, keys from a secret manager).

## S4 Database
- S4-1 · MUST · REVIEW · Migrations reversible or marked irreversible with a backup step; expand-and-contract for live tables.
- S4-2 · ARCH · REVIEW · Least-privilege DB users; tenant isolation by query scoping or row-level security (state which).
- S4-3 · MUST · REVIEW · Synthetic data only in seeds, fixtures and tests. Card numbers not stored without approved PCI scope; CVV never.
- S4-4 · MUST · REVIEW · Financial records append-only; corrections are new rows.

## S5 Supply chain and AI-agent risks
- S5-1 · MUST · TOOL (CI) · Lockfile committed; CI installs frozen.
- S5-2 · SHOULD · TOOL · Release-age cooldown of 7 days in the package manager config; install scripts blocked except an allowlist.
- S5-3 · SHOULD · TOOL (CI) · Dependency audit on every PR (fail on high/critical with a fix); GitHub Actions pinned to commit SHAs with minimal `permissions:`; no secrets for fork PRs; no untrusted code under pull_request_target.
- S5-4 · MUST · REVIEW · Never `curl … | sh`. AI-suggested packages, URLs, repos and skills are verified real before use.
- S5-5 · MUST · REVIEW · If the app calls an LLM: model output is untrusted input; tool calls it triggers still pass authorization; no secrets in prompts.

## Enforcement status
| Layer | Status (SET / PROPOSED / UNVERIFIED) |
| --- | --- |
| Dependency audit in CI (`pnpm audit --audit-level high`) | SET (`.github/workflows/ci.yml`) |
| Release-age cooldown 7 days | SET (`pnpm-workspace.yaml:4`) |
| Install-script allowlist (`allowBuilds`) | SET (`pnpm-workspace.yaml`) |
| GitHub Actions pinned to SHAs, `contents: read` | SET (`.github/workflows/ci.yml`) |
| Dependabot with 7-day cooldown | SET (`.github/dependabot.yml`) |
| Claude settings deny rules and attribution off | PROPOSED (`.ai/setup/proposals/settings.json`) |
| Git hooks / pre-commit | PROPOSED (none exist) |
| Secret scanning | PROPOSED (none exist) |
| SAST / CodeQL, lint | PROPOSED (none exist) |

## External script inventory
None. No external scripts, CDNs, analytics or web fonts; the Iconify API is off. Only same-origin fetches of `public/packs/` files.

