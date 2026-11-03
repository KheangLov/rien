---
name: implement
description: Implement an approved task file from .ai/tasks/ (any writer) after the Import Check.
argument-hint: <slug>
model: sonnet
effort: medium
---
Task: .ai/tasks/$ARGUMENTS.md (no argument = newest file there).
Run the Import Check in .ai/TASK_CONTRACT.md. Read only the task file and its files_to_read.
Show the check table, your confidence and the planned files; STOP for the task's approval_word typed by the user.
implement_tier above BUILD → add the escalation line from .ai/WORKFLOW.md (Routing).
After approval: approved_hash, status in-progress, WORKFLOW phases 6–10, status done.
