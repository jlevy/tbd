---
type: is
id: is-01m2nez0ta9ekv0f967pzxfsh6
title: Preserve review state when submitting an existing PR stack
kind: bug
status: in_progress
priority: 1
version: 2
delegate: codex@spud10
labels:
  - stacked-prs
  - docs
dependencies: []
hold: null
hold_until: null
created_at: 2026-09-16T15:56:58.567Z
updated_at: 2026-09-16T15:57:20.676Z
started_at: 2026-09-16T15:57:20.674Z
---
The PR shortcuts prescribe gh stack submit --auto --open unconditionally. Since --open marks new and existing PRs ready for review, updating one draft layer can publish the entire stack. Document state-preserving submission and require explicit intent before opening drafts. Add workflow text coverage.
