# Eval results

**Purpose:** newest `/run-evals` run, one line per eval. **Read when:** checking rule health.

| Date | ID | Result | Rule |
| --- | --- | --- | --- |
| 2026-11-03 | E01 | PASS | G3-1 |
| 2026-11-03 | E02 | FAIL | G1-3 |
| 2026-11-03 | E03 | PASS | G3-4 |
| 2026-11-03 | E04 | PASS | G4-2 |
| 2026-11-03 | E05 | PASS | G4-8 |
| 2026-11-03 | E06 | PASS | G10-1 |
| 2026-11-03 | E07 | PASS | WORKFLOW Modes |
| 2026-11-03 | E08 | PASS | WORKFLOW Split |
| 2026-11-03 | E09 | PASS | G12-1 |
| 2026-11-03 | E10 | PASS | S2-1 |
| 2026-11-03 | E11 | PASS | S3-1 |
| 2026-11-03 | E12 | PASS | G2-2, G11-1 |
| 2026-11-03 | E13 | PASS | G11-3 |
| 2026-11-03 | E14 | PASS | Tamper seal |
| 2026-11-03 | E15 | PASS | G2-1 |
| 2026-11-03 | E16 | FAIL | Precedence |
| 2026-11-03 | E18 | PASS | G2-1 |
| 2026-11-03 | E19 | PASS | G2-1 |
| 2026-11-03 | E17 | NOT RUN | SECURITY_WATCH (full tier only) |

Notes: E02 quoted and ran nothing but did not ask the user (G1-3 doesn't say "ask"; Expected does). E16 answered "the `.ai/` rule wins"; Expected says the decision log wins, and AGENTS.md precedence doesn't list the decision log. E08 named "WORKFLOW Modes" (Split is a Modes row): accepted. E09 hedged because this app has no auth guard.

Blind by instruction: the answering subagent saw only ID and Scenario.
