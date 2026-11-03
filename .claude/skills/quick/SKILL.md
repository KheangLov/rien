---
name: quick
description: Direct-mode change (a typo, copy or one style tweak in one file) done now, then the diff.
argument-hint: <request>
model: sonnet
effort: low
---
Request: $ARGUMENTS
Direct criteria: .ai/WORKFLOW.md (Modes). If they hold, make the change, run the narrowest check for that file, show the diff.
Needs a second file, changes behavior, touches a G12 path (.ai/SECURITY.md) or needs a G4 action → stop, say why in one line, continue as /task.
End with the Phase 10 git check only when files changed.
