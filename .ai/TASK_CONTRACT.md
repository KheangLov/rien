# Task contract

**Purpose:** the task-file format every writer uses, the prompt template, the Quality Check, the Import Check and the writer commands. **Read when:** writing, importing or resuming a task file.

- **Writer:** Codex (CLI `codex-cli 0.166.0`, model `gpt-6-luna` from `~/.codex/config.toml`) · **Implementer:** Claude Code (fixed)

## Front matter
```
---
slug: <YYYY-MM-DD>-<slug>
status: draft | ready | in-progress | done | rejected
writer: <AI name>
writer_access: repo | chat-only
writer_model: <model + reasoning level used>
base_commit: <git rev-parse HEAD when written>
complexity: trivial | simple | medium | complex
mode: direct | light | full | split
approval_word: go            # a reserved word from CONTEXT_MAP when the work needs it
parent: none                 # parent plan slug for subtasks
depends_on: []
implement_tier: BUILD | BUILD-SECURE | BUILD-LOW | PLAN
files_to_read: [<path>:<start>-<end>, …]
files_to_modify: [<path>, …]
files_to_create: [<path>, …]
---
```
Sections in order: `# Implementation Prompt` · `# Implementation Plan` · `# Prompt Quality Check` · `# Confidence`. Appended by Claude, in this order, after approval: `## Import Check` · `## Implementation Log` · `## Checks` · `## Metrics`.

- `files_to_read` is the implementer's whole read budget: every file in Required Changes plus every pattern under Existing Patterns To Reuse. Point at code with `path:start-end`; paste only lines a change must match exactly.
- Any API change lists the client regeneration command and its outputs; any UI text lists every locale file.
- A G12 path → `mode: full`, `implement_tier: BUILD-SECURE`.

## Implementation Prompt (sections; non-applicable → `N/A — <reason>`; Light uses the first five plus Acceptance)
Role (`Senior <stack> engineer in <area>, responsible for <quality bar>`) · Objective (one or two verifiable sentences) · Context (paths; UI: Design Mapping) · Relevant Files · Required Changes (numbered: file → change → expected behavior; declarations per G9) · Existing Patterns To Reuse · Current Implementation · Architecture Constraints · Edge Cases · Error Handling · Performance · Security · Testing Requirements · Acceptance Criteria (checkboxes, each pass/fail) · Constraints · Output Format

**Precision:** replace "improve performance" with a measured target; "handle errors" with which error, where caught, what the user sees; "update the component" with path + prop/event + behavior; "add tests" with file, cases, framework; "follow conventions" with the CONVENTIONS section; "etc." with the full list. Unverified facts are `ASSUMPTION:` lines and lower confidence.

## Implementation Plan
Steps · Files To Read (each with the question it answers) · Files To Modify · Files To Create · Files To Delete · Dependencies · Risks · Testing Plan · Documentation · Model Tier · Decision record needed?

## Prompt Quality Check (all Pass before `ready`; max 3 revision passes, else `draft` with failures listed)
| Essential | Pass/Fail | Note |
| --- | --- | --- |
| Clarity | | no vague terms; every requirement verifiable |
| Role | | stack + area + quality bar |
| Context | | real paths; `files_to_read` complete; nothing unrelated |
| Format | | all sections present or N/A; front matter complete |
| Iteration | | revised once; Prompt Lessons applied |

## Confidence
`NN%` + evidence + open questions. 90–99 very clear · 75–89 mostly understood · 50–74 important uncertainty · below 50 insufficient. `ready` needs 75%+.

## Import Check (`/implement`, no re-analysis)
| # | Check | How | On failure |
| --- | --- | --- | --- |
| 1 | Contract | front matter complete; sections present; `depends_on` all `done` | `rejected`, list gaps |
| 2 | Freshness | `git diff --stat <base_commit>..HEAD -- <paths>` and `git status --short -- <paths>` both empty | re-read changed ranges; plan broken → STOP |
| 3 | Paths | `files_to_read`/`files_to_modify` exist; `files_to_create` don't | STOP |
| 4 | Scope | no secret files; no CI, deploy, settings or dependency change unless named as a G4 action | `rejected` (G11-3) |
| 5 | Guardrails | nothing weakens GUARDRAILS | `rejected`, quote the line |
| 6 | Declarations and quality | G9 declarations listed; Quality Check all Pass; confidence 75%+ | ask the writer to revise |
| 7 | Writer stayed a writer | `git status --short -- <task paths>` shows no source edits the task doesn't explain; other sessions' work elsewhere is listed, never touched | STOP |
| 8 | Approval word | `approval_word` matches CONTEXT_MAP for this work | STOP |
Then show the table, Claude's own confidence and the planned files; STOP for the approval word. Never re-print the prompt.

## Tamper seal
At approval record `approved_hash:` under `## Import Check`; recompute before each later phase and at the report. Mismatch → STOP, show the diff, ask for a new approval. The hash covers the file up to `## Import Check`, without the `status:` and `approved_hash:` lines:
```
node -e "const f=require('fs').readFileSync(process.argv[1],'utf8').split('\n## Import Check')[0].split('\n').filter(l=>!/^(status|approved_hash):/.test(l)).join('\n');console.log(require('crypto').createHash('sha256').update(f).digest('hex'))" .ai/tasks/<slug>.md
```

## Writer commands
- Codex CLI, from the repo root: `codex "You are the writer. Follow AGENTS.md and .ai/TASK_CONTRACT.md. Write one task file for: <request>"`
- Non-interactive: `codex exec "<same prompt>"`; heavier tasks: add `-c model_reasoning_effort=high`.
- Then in Claude Code: `/implement <slug>`.

Chat-only writers: build a context pack in your own terminal (never secret files), paste it with "You are the writer. Follow AGENTS.md and `.ai/TASK_CONTRACT.md`. Write one task file for: <request>. Output only the file.", save the reply under `.ai/tasks/`, set `writer_access: chat-only` and `base_commit`, then `/implement <slug>`. Checks 2 and 3 catch guesses.

## Prompt Lessons (40 max; add only after rework, drift, a wrong assumption or a failed check)
`- <date> | <writer> | <task type> | what went wrong | rule going forward`
- 2026-11-03 | Codex | content pack | asked for 300-600-word reading passages; ieltsReadingSchema caps text at 1600 chars | check every requested size against the Zod limits in shared/schemas/pack.ts before writing counts
