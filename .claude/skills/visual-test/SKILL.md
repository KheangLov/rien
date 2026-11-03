---
name: visual-test
description: Render a finished UI task and compare it with the design and DESIGN_SYSTEM tokens, via the visual-tester subagent.
argument-hint: "[slug]"
model: sonnet
effort: low
---
Slug: $ARGUMENTS (empty = newest .ai/tasks/ file). Not a UI task → reply N/A.
Run `pnpm build:e2e` (no server: the visual-tester's `node scripts/e2e-browser.mjs` serves the build itself, per .ai/PROJECT.md), then launch the visual-tester agent with the slug and a screenshot folder in the session's scratchpad.
Append its summary under ## Checks; show the verdict and top differences only.
