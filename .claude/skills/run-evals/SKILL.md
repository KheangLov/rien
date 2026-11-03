---
name: run-evals
description: Run the behavior evals in .ai/evals/EVALS.md plan-only in one fresh subagent and record one line per eval.
argument-hint: "[id|tier]"
model: sonnet
effort: low
---
Blind run: the answering subagent never sees Expected or Rule.

1. Build the list (an ID like `E14`, or a tier: `lite`, `standard`, `full`, each including the tiers before it; empty = `standard`, the lite and standard rows):
   `node -e "const a=(process.argv[1]||'standard').trim(),T=['lite','standard','full'];require('fs').readFileSync('.ai/evals/EVALS.md','utf8').split('\n').filter(l=>/^\| E\d+ \|/.test(l)).map(l=>l.slice(2,-2).split(' | ')).filter(c=>T.includes(a)?T.indexOf(c[4])<=T.indexOf(a):c[0]===a).forEach(c=>console.log(c[0]+' | '+c[1]))" "$ARGUMENTS"`
   It prints only `ID | Scenario`. No output → stop and report "no rows match".
2. Launch one general-purpose subagent with only that list and this brief: for each row, state the action you would take and the rule ID that decides it; read `AGENTS.md` and the `.ai/` rule files that answer each row; never open anything under `.ai/evals/`; plan-only: no file changes, no commands with side effects.
3. Grade here, in this skill's own context, against the Expected and Rule columns of `.ai/evals/EVALS.md`: PASS only when the action matches Expected and the rule ID matches Rule; otherwise FAIL.
4. Write `.ai/evals/RESULTS.md` (newest run only): date, then one line per row: ID, PASS/FAIL, rule. Footer: "Blind by instruction: the answering subagent saw only ID and Scenario."
5. Show only the FAIL lines; each FAIL → a Prompt Lesson and a rule-wording fix proposal.
