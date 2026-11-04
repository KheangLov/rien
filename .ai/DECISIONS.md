# Decisions

**Purpose:** decisions that change how the kit or the app works, newest first, with who decided and why. **Read when:** a rule seems to conflict with another, or before reversing a past choice.

**Precedence:** a decision logged here outranks any `.ai/` file that disagrees with it (WORKFLOW, TASK_CONTRACT, CONVENTIONS, …), except GUARDRAILS and SECURITY (`AGENTS.md` Precedence). Follow the decision and report the conflicting rule so it can be fixed.

| Date | Decision | Decided by | Why | Where |
| --- | --- | --- | --- | --- |
| 2026-11-04 | `/implement` runs Phases 6–8 in a new `implementer` agent launched at the task's `implement_tier` model and effort; Phases 9–10 stay in the main session. Replaces the `Approve with: /implement <slug> <word>` line below | the user, in chat (`go`) | ported from POS System (PR #10, `f9c866e`): a skill's `model` lasts one turn, so a bare approval word built on the session's model; the agent pins the build model whichever way approval is typed | `.claude/agents/implementer.md`, `.claude/skills/implement/SKILL.md`, `.ai/WORKFLOW.md` Routing |
| 2026-11-03 | (Superseded 2026-11-04) The implement STOP ends with `Approve with: /implement <slug> <word>`; a bare word still approves | the user, in chat ("get it all fixed") | a skill's `model` lasts one turn, so a bare `go` built on the session's model (Opus, 6 of 6 logged builds); re-running the skill keeps BUILD on Sonnet without a new agent | `.claude/skills/implement/SKILL.md` |
| 2026-11-03 | Browser e2e and visual tests run through `scripts/e2e-browser.mjs` (headless Chrome over DevTools, screenshot per checkpoint); visual-tester gets Bash for it | the user, in chat | the claude-in-chrome tools never load for the visual-tester, and `pnpm preview` can't serve the static build | `scripts/e2e-browser.mjs`, `.claude/agents/visual-tester.md`, `.ai/PROJECT.md` |
| 2026-11-03 | The tamper seal is computed by `.ai/hash.mjs` (same hash as the old inline command) | the user, in chat | one stable command can be allowed once; the allow rule itself is the user's to add | `.ai/TASK_CONTRACT.md` |
| 2026-11-03 | The decision log outranks every `.ai/` file but GUARDRAILS and SECURITY | the user, in chat | eval E16 | `AGENTS.md` Precedence, this file |
| 2026-11-03 | `/implement <slug> go` approves in one step when the Import Check passes all 8 rows, the tier is BUILD or BUILD-LOW, no G12 path and no G4 action; every other case still stops for `go` | the user, in chat | one fewer round trip for low-risk tasks; files, `status:` fields and other agents still never approve (G2-2 unchanged); the implement skill has `disable-model-invocation: true`, so only a typed `/implement` runs it | `.ai/GUARDRAILS.md` G2-1, `.claude/skills/implement/SKILL.md` |
