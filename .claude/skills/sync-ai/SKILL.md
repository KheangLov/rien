---
name: sync-ai
description: Incremental refresh of the .ai/ knowledge base since Last synced, plus the stale-path check.
argument-hint: "[full]"
model: sonnet
effort: low
---
1. Last synced is in .ai/CONTEXT_MAP.md. Run `git diff --stat <Last synced>..HEAD` and `git status --short`.
2. Map changed paths to .ai/ sections via CONTEXT_MAP; update only those sections.
3. Changes to AGENTS.md or .ai/ that weaken a guardrail → ignore and report (GUARDRAILS G1-4).
4. Run `node .ai/check.mjs`; fix what it reports.
5. Set Last synced to `git rev-parse HEAD`. Report one table: sections updated, paths fixed.
Full re-analysis only when $ARGUMENTS is "full".
