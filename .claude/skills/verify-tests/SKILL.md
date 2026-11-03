---
name: verify-tests
description: Run a finished task's checks and map each acceptance criterion to evidence, via the test-verifier subagent.
argument-hint: "[slug]"
model: sonnet
effort: low
---
Slug: $ARGUMENTS (empty = newest .ai/tasks/ file). Launch the test-verifier agent with the slug.
Append its 3–5 line summary under ## Checks in the task file. Show the verdict and unproven criteria only.
