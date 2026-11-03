---
name: task
description: Plan a change — route, analyze, write the implementation prompt and plan into a task file with confidence, then STOP.
argument-hint: <request>
model: opus
effort: medium
---
Run .ai/WORKFLOW.md phases 0–5 for: $ARGUMENTS
Write .ai/tasks/<YYYY-MM-DD>-<slug>.md per .ai/TASK_CONTRACT.md (writer: claude).
Show the route line, objective, files, acceptance criteria and confidence; never print the whole task file. STOP for the approval word.
Phase 0 routes to a writer or a higher tier → print the route or escalation line and stop.
