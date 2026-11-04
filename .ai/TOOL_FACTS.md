# Tool facts

**Purpose:** installed tool versions and settings verified for real. **Read when:** a rule depends on a tool feature; updated by `/verify-setup`.

| Item | Value | Status (SET / UNVERIFIED / BROKEN) | Checked |
| --- | --- | --- | --- |
| Node | 26.13.0 (`.nvmrc`); the user's `!` shell may pick Node 24.19 from a codex runtime, so run `source ~/.nvm/nvm.sh; nvm use` first | SET | 2026-11-04 |
| pnpm | 11.28.10 | SET | 2026-11-04 |
| Claude Code | 2.1.318 | SET | 2026-11-04 |
| Codex CLI | 0.166.0, model `gpt-6-luna` | SET | 2026-11-04 |
| Figma MCP | `figma` server connected | SET | 2026-11-03 |
| Formatter / linter | none in the repo | SET | 2026-11-03 |
| visual-tester browser | agent now has Read + Bash (restricted to the e2e script); 4 Nov fresh session: it ran `node scripts/e2e-browser.mjs`, headless Chrome 156 started and the e2e runner played (START, SCREEN, PASS lines seen). Full run with screenshots and the DONE line not yet checked from the agent | SET | 2026-11-04 |
| browser e2e (`scripts/e2e-browser.mjs`) | headless Chrome 156 over DevTools: 23/23, 57 screenshots at 390×844 | SET | 2026-11-03 |
| tamper-seal command | `node .ai/hash.mjs <task>` prints the hash (exit 0). 4 Nov: it runs with no prompt because the user's `~/.claude/settings.json` has `autoMode` on (an unrelated `node -e` also ran unprompted), not because of an allow rule. Outside auto mode it may prompt; the user can add `Bash(node .ai/hash.mjs:*)` if so | SET | 2026-11-04 |
| settings deny rules accepted | `.claude/settings.json` installed; loaded mid-session: Read of the (absent) root .env refused ("denied by your permission settings"), Bash `rm -rf` on a missing folder refused; 4 Nov: an Edit of pnpm-lock.yaml refused ("directory denied by your permission settings"); `git push --dry-run` is NOT refused (Everything up-to-date), by design: only force pushes are denied (G4-9) | SET | 2026-11-04 |
| attribution setting honored | after install the session's attribution instruction changed to "do not add attribution lines" | SET | 2026-11-03 |
| hooks | none installed (no hooks key in .claude/settings.json), nothing to test | SET | 2026-11-04 |
| skill `model` frontmatter honored | `/verify-setup` has `model: sonnet`; `/verify-setup` (model: sonnet) ran again as claude-sonnet-5-5 | SET | 2026-11-04 |
| skill `effort` frontmatter honored | `effort:` is set in every skill and agent file; it can't be observed from inside a session, so this was not tested. Marked SET on the user's say-so (4 Nov), not on evidence | SET | 2026-11-04 |
