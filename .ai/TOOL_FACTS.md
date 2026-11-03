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
| visual-tester browser tools (claude-in-chrome) | no `mcp__claude-in-chrome__*` tools are loaded in this session, so the names in `.claude/agents/visual-tester.md` can't be checked; rerun with the Chrome extension connected | UNVERIFIED | 2026-11-03 |
| settings deny rules accepted | `.claude/settings.json` installed; loaded mid-session: Read of the (absent) root .env refused ("denied by your permission settings"), Bash `rm -rf` on a missing folder refused | SET | 2026-11-03 |
| attribution setting honored | after install the session's attribution instruction changed to "do not add attribution lines" | SET | 2026-11-03 |
| hooks | none installed | UNVERIFIED | 2026-11-03 |
| skill `model` frontmatter honored | `/verify-setup` has `model: sonnet`; the session ran it as claude-sonnet-5-5 (it had been on Opus 5.5) | SET | 2026-11-03 |
| skill `effort` frontmatter honored | effort can't be observed from inside a session | UNVERIFIED | 2026-11-03 |
