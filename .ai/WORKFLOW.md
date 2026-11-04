# Workflow

**Purpose:** modes, phases 0–10, token rules, model routing, splitting, git check. **Read when:** starting or resuming any task.

## Modes (Phase 0 picks one)
| Mode | When | Flow |
| --- | --- | --- |
| Direct | a question; a command the user named; one file, 20 changed lines or fewer, no behavior/API/state change; or `/quick` and nothing below applies | do it, show the diff; no prompt or plan |
| Light | 1–3 files, a clear behavior change | Role, Objective, Files, Changes, Acceptance + confidence → STOP |
| Full | 4–8 files (more than 8 is Split), a feature, an API/state/data-flow change, any G12 path, a dependency or security config | full template (TASK_CONTRACT) → STOP |
| Split | more than 8 files or 400 changed lines; separately testable layers; task file over 200 lines | parent plan, then each subtask in its own mode |

Direct work that grows past Direct → stop, say why in one line, switch to Light. Never shrink a description to dodge the gate.

## Phases
0. **Route** — rate complexity (Trivial · Simple · Medium · Complex), pick mode and tiers (Routing), print one line: `Route: medium · Full · writer → <writer> · implement → claude BUILD · checks → REVIEW + CHECK`. Handoff chosen → give the writer command (TASK_CONTRACT) and stop. Tier too low → print the escalation line and wait.
1. **Analyze** — restate the task in one sentence; read CONTEXT_MAP, then only routed sections; find affected files, patterns and declarations to reuse; ask blocking questions now.
2. **Prompt** — write it per TASK_CONTRACT into `.ai/tasks/<YYYY-MM-DD>-<slug>.md`; never invent files, APIs, tokens or behavior; run the Quality Check.
3. **Plan** — steps, `files_to_read` with line ranges, `implement_tier`.
4. **Confidence** — a number with evidence (paths read, commands run) and every open question; a blocking question caps it below 75%.
5. **STOP** — no code until the approval word (GUARDRAILS G2; `/implement` one-step per G2-1).
6. **Execute** — `status: in-progress`; record `approved_hash` (TASK_CONTRACT seal); implement exactly the approved scope; tests, typecheck, lint, build; log files read and commands run.
7. **Review** — CONVENTIONS checklist on your own diff; fix what it finds. G12 paths: security pass. Complexity medium or complex → `/check-all <slug>` after your own review; its rows go under `## Checks`; not run → a `NOT RUN` row with the reason.
8. **Document** — update `.ai/` only when structure, boundaries, data flow, security, integrations, tokens or workflow changed; decisions go to the repo's decision log (none → create `DECISIONS.md` in `.ai/`); add a Prompt Lesson when a prompt caused rework.
9. **Report** — `status: done`; a table: summary, files, check results, `.ai/` updates, risks, tiers used, Metrics; then the installed check commands with the slug filled.
10. **Git check** — read-only `git status -sb`, `git diff --stat`, `git log --oneline -5`; one table (6 rows max) flagging the default branch, files outside the plan, secret-like or build files; ask commit / new branch / leave; wait.

**Plan change before approval:** revise prompt and plan, re-run the Quality Check and confidence, STOP again. **After approval:** a discovery that breaks the plan → STOP with what changed and new confidence; recommend escalation; wait.

**Split:** parent plan `.ai/tasks/<date>-<slug>-plan.md` (40 lines max) with 2–5 subtasks, each shippable alone with its `depends_on`; one task file, session, approval and git check per subtask; `/clear` between them.

## Token rules
- Before each read, name the question it answers. Search with line numbers, then read about 60 lines around the hit; whole files only at 300 lines or fewer when most of it is needed.
- Never re-read an unchanged file; never read lockfiles, build output, coverage, snapshots or minified files.
- Search subagents only for sweeps across many directories; they return conclusions and `file:line`, never dumps.
- Diffs: `--stat` first, then only the paths you must inspect. Tests: scoped first, quiet reporter, read only failures.
- No restating the task, no echoing files, no narration; `N/A — <reason>` for template sections that don't apply.
- One task per session; `/clear` between unrelated tasks; resume from the task file, not by re-analysis. Prefer `/sync-ai` over full re-analysis.
- A model switch drops the prompt cache: switch only between phases or sessions.
- Handed-off tasks: Claude reads only the task file and `files_to_read`; a missing fact → STOP and list it for the writer.

## Routing (tiers)
| Tier | Used for | Claude (`model` / `effort`) | Writer |
| --- | --- | --- | --- |
| PLAN-HIGH | complex prompts, migrations, architecture | opus / high | `gpt-6-luna` (reasoning high) |
| PLAN | medium prompts, analysis, docs | opus / medium | `gpt-6-luna` (reasoning medium, the config default) |
| BUILD | implementing an approved task | sonnet / medium | — |
| BUILD-SECURE | implementing a G12-path task | opus / medium (high in profile `high`) | — |
| BUILD-LOW | Direct, `/sync-ai`, reports | sonnet / low | — |
| REVIEW | code-reviewer | sonnet / high (opus / high for G12 in profile `high`) | — |
| CHECK | test-verifier, visual-tester | sonnet / low | — |

| Complexity | Prompt written by | Implement | Checks |
| --- | --- | --- | --- |
| Trivial | Claude, Direct | BUILD-LOW | none |
| Simple | Claude (writer if Claude's budget is tight) | BUILD | CHECK |
| Medium | writer, PLAN | BUILD (BUILD-SECURE on G12) | REVIEW + CHECK |
| Complex | writer, PLAN-HIGH | BUILD; PLAN for migrations | REVIEW + CHECK |

Escalation line (skills can't switch their own tier): `Route: complex → run /task after /model opus and /effort high, or hand off to <writer>`. Never claim a switch that didn't happen. Escalate on a Scope Protection STOP, two failed fix loops or confidence below 75%.

## Cheat sheet
| I want to… | Do |
| --- | --- |
| fix a typo or tweak one style | `/quick <request>` |
| plan a change | `/task <request>` → review → type the approval word |
| implement a writer's task file | `/implement <slug>` → review → approval word |
| check finished work | `/check-all <slug>` |
| build a screen from Figma | `/figma-ui <url>` |
| refresh the docs | `/sync-ai` |
