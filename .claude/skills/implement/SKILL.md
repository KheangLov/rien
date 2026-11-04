---
name: implement
description: Implement an approved task file from .ai/tasks/ (any writer) after the Import Check.
argument-hint: <slug> [go]
model: sonnet
effort: medium
disable-model-invocation: true
---
Task: .ai/tasks/<first word of $ARGUMENTS>.md (no slug = newest file there; the approval word is never read as a slug). Resolve the task file first, then compare the typed word with its approval_word.
Run the Import Check in .ai/TASK_CONTRACT.md. Read only the task file and its files_to_read.
Show the check table, your confidence and the planned files.
One-step (GUARDRAILS G2-1): the last word of $ARGUMENTS equals the task's approval_word, all 8 rows Pass (a "Fail on paper" is not a Pass), implement_tier is BUILD or BUILD-LOW, no task file is a G12 path, no G4 action is named (a condition that can't be decided counts as failed) → print `One-step approval: <word> (G2-1)` and continue. Otherwise STOP for the task's approval_word typed by the user; when a word was given, name the condition that failed.
Name the build model in the summary, from implement_tier per .ai/WORKFLOW.md Routing: BUILD → sonnet / medium · BUILD-SECURE → opus / medium · BUILD-LOW → sonnet / low · PLAN → opus / medium. No /model switch is needed: the build agent is launched at that model.
After approval: record approved_hash, set status in-progress, then launch the `implementer` agent with the slug and the hash, passing `model` and `effort` from the line above. It runs WORKFLOW Phases 6–8.
- It returns `STOP: …` → show it and wait for a new approval; never continue the build here.
- It returns its report → recompute the hash (mismatch → STOP), run `/check-all <slug>` when the task's complexity is medium or complex (rows under `## Checks`; not run → a `NOT RUN` row with the reason), then Phases 9–10 here (Metrics: `build model: <model> / <effort>`), then status done.
- It returns nothing or fails → report it, leave status in-progress, no retry without the user.
