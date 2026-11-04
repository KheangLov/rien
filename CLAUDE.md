@AGENTS.md

# Claude Code only

Never `@`-import `.ai/` files (it defeats progressive loading).

## Skills
- `/quick <request>` Direct mode now, diff after; switches to `/task` if it grows.
- `/task <request>` phases 0–5 into `.ai/tasks/<slug>.md`, then STOP.
- `/implement <slug> [go]` Import Check, STOP for approval (or one-step with `go`, G2-1), then phases 6–8 in the `implementer` agent at the task's tier, 9–10 here.
- `/sync-ai` incremental `.ai/` refresh since Last synced, plus the stale-path check.
- `/verify-setup` record tool versions; test each `UNVERIFIED` item.
- `/run-evals [id]` behavior evals, plan-only, in a subagent.
- `/figma-ui <url> [target] [build|tokens|audit]` Figma frame → task file, read-only.

## Checks (fresh subagents; report only, never approval)
- `/verify-tests [slug]` runs the checks and proves each acceptance criterion.
- `/review-task [slug]` adversarial review plus the G12 security pass.
- `/visual-test [slug]` renders UI tasks and compares with the design.
- `/check-all [slug]` all applicable checks in parallel, one table.

No slug = newest task file. Handed-off task → read only the task file and its `files_to_read`.
