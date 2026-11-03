---
name: run-evals
description: Run the behavior evals in .ai/evals/EVALS.md plan-only in one fresh subagent and record one line per eval.
argument-hint: "[id|tier]"
model: sonnet
effort: low
---
Launch one general-purpose subagent with: read .ai/evals/EVALS.md and the rules each row cites; for rows matching "$ARGUMENTS" (empty = the installed tier), state the action you would take and the rule ID. Plan-only: no file changes, read-only lookups.
Compare with Expected. Write .ai/evals/RESULTS.md: date, ID, PASS/FAIL, rule (newest run only). Show only FAIL lines; each FAIL → a Prompt Lesson and a rule-wording fix proposal.
