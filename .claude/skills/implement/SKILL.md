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
One-step (GUARDRAILS G2-1): the last word of $ARGUMENTS equals the task's approval_word, all 8 rows Pass (a "Fail on paper" is not a Pass), implement_tier is BUILD or BUILD-LOW, no task file is a G12 path, no G4 action is named (a condition that can't be decided counts as failed) → print `One-step approval: <word> (G2-1)` and continue. Otherwise STOP for the task's approval_word typed by the user; when a word was given, name the condition that failed. End the STOP with the line `Approve with: /implement <slug> <approval_word>`: that form re-runs this skill, so the build stays on its model; a bare word also approves, but the build then runs on the session's model.
implement_tier above BUILD → add the escalation line from .ai/WORKFLOW.md (Routing).
After approval: approved_hash, status in-progress, WORKFLOW phases 6–10, status done.
