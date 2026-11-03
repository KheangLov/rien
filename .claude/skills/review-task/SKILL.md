---
name: review-task
description: Independent adversarial code review of a finished task's diff by the code-reviewer subagent (includes the G12 security pass).
argument-hint: "[slug]"
model: sonnet
effort: low
---
Slug: $ARGUMENTS (empty = newest .ai/tasks/ file). Launch the code-reviewer agent with the slug (and the commit, if the work is committed).
The agent is read-only: append its 3–5 line summary under ## Checks in the task file yourself. Show its verdict and BLOCKER/MAJOR findings only. Never fix anything here.
