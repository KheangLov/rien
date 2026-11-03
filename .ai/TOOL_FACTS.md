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
| visual-tester browser tools (claude-in-chrome) | tool names not checked against a live session | UNVERIFIED | — |
| settings deny rules accepted | — | UNVERIFIED | — |
| skill and agent `model`/`effort` frontmatter honored | — | UNVERIFIED | — |
