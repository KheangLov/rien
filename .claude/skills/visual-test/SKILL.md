---
name: visual-test
description: Render a finished UI task and compare it with the design and DESIGN_SYSTEM tokens, via the visual-tester subagent.
argument-hint: "[slug]"
model: sonnet
effort: low
---
Slug: $ARGUMENTS (empty = newest .ai/tasks/ file). Not a UI task → reply N/A.
Start the app with the session's preview/dev-server tool (never a raw shell server) per .ai/PROJECT.md, then launch the visual-tester agent with the slug and the URL.
Append its summary under ## Checks; show the verdict and top differences only.
