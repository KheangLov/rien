# Tool facts

**Purpose:** installed tool versions and settings verified for real. **Read when:** a rule depends on a tool feature; updated by `/verify-setup`.

| Item | Value | Status (SET / UNVERIFIED / BROKEN) | Checked |
| --- | --- | --- | --- |
| Node | 26.13.0 (`.nvmrc`); the user's `!` shell may pick Node 24.19 from a codex runtime, so run `source ~/.nvm/nvm.sh; nvm use` first | SET | 2026-11-03 |
| pnpm | 11.28.10 | SET | 2026-11-03 |
| Claude Code | 2.1.317 | SET | 2026-11-03 |
| Codex CLI | 0.166.0, model `gpt-6-luna` | SET | 2026-11-03 |
| Figma MCP | `figma` server connected | SET | 2026-11-03 |
| Formatter / linter | none in the repo | SET | 2026-11-03 |
| visual-tester browser | claude-in-chrome tools never loaded (agent ran with Read/Grep/Glob only, twice); replaced by Bash + `node scripts/e2e-browser.mjs`, which ran 23/23 with screenshots from the main session. Agent files load at session start, so the agent's new Bash tool is checked next session | UNVERIFIED | 2026-11-03 |
| browser e2e (`scripts/e2e-browser.mjs`) | headless Chrome 156 over DevTools: 23/23, 57 screenshots at 390×844 | SET | 2026-11-03 |
| tamper-seal command | `node .ai/hash.mjs` gives the same hash as the old inline command; it still prompts until `Bash(node .ai/hash.mjs:*)` is in the allow list (an agent may not add its own permissions) | UNVERIFIED | 2026-11-03 |
| settings deny rules accepted | `.claude/settings.json` installed; loaded mid-session: Read of the (absent) root .env refused ("denied by your permission settings"), Bash `rm -rf` on a missing folder refused | SET | 2026-11-03 |
| attribution setting honored | after install the session's attribution instruction changed to "do not add attribution lines" | SET | 2026-11-03 |
| hooks | none installed | UNVERIFIED | 2026-11-03 |
| skill `model` frontmatter honored | `/verify-setup` has `model: sonnet`; the session ran it as claude-sonnet-5-5 (it had been on Opus 5.5) | SET | 2026-11-03 |
| skill `effort` frontmatter honored | effort can't be observed from inside a session | UNVERIFIED | 2026-11-03 |
