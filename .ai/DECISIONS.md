# Decisions

**Purpose:** decisions that change how the kit or the app works, newest first, with who decided and why. **Read when:** a rule seems to conflict with another, or before reversing a past choice.

| Date | Decision | Decided by | Why | Where |
| --- | --- | --- | --- | --- |
| 2026-11-03 | `/implement <slug> go` approves in one step when the Import Check passes all 8 rows, the tier is BUILD or BUILD-LOW, no G12 path and no G4 action; every other case still stops for `go` | the user, in chat | one fewer round trip for low-risk tasks; files, `status:` fields and other agents still never approve (G2-2 unchanged); the implement skill has `disable-model-invocation: true`, so only a typed `/implement` runs it | `.ai/GUARDRAILS.md` G2-1, `.claude/skills/implement/SKILL.md` |
