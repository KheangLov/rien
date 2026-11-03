---
name: check-all
description: Run every applicable post-task check agent in parallel and merge their reports.
argument-hint: "[slug]"
model: sonnet
effort: low
---
Slug: $ARGUMENTS (empty = newest .ai/tasks/ file). In one message launch code-reviewer and test-verifier, plus visual-tester for UI tasks (start the app first as in /visual-test).
Append each summary under ## Checks. Show one table: agent, verdict, blockers, top finding.
