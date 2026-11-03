---
name: figma-ui
description: Build, update, token-diff or audit UI from a Figma frame URL, per .ai/DESIGN_SYSTEM.md.
argument-hint: <url> [target] [build|tokens|audit] ["notes"]
model: opus
effort: medium
---
Args: $ARGUMENTS. Follow the Figma section of .ai/DESIGN_SYSTEM.md (server instructions first, then node-only fetches).
Build the Design Mapping table: each Figma variable/component → code token/component, or UNMAPPED.
audit → report differences and stop. tokens → token changes as a task file. build (default) → task file per .ai/TASK_CONTRACT.md with the mapping in Context; STOP for approval.
Figma is read-only (GUARDRAILS G4-6).
