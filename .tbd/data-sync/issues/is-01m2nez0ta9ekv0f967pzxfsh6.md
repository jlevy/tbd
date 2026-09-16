---
type: is
id: is-01m2nez0ta9ekv0f967pzxfsh6
title: Preserve review state when submitting an existing PR stack
kind: bug
status: closed
priority: 1
version: 4
delegate: codex@spud10
labels:
  - stacked-prs
  - docs
dependencies: []
hold: null
hold_until: null
created_at: 2026-09-16T15:56:58.567Z
updated_at: 2026-09-16T16:53:58.048Z
started_at: 2026-09-16T15:57:20.674Z
closed_at: 2026-09-16T16:53:58.048Z
close_reason: Implemented with focused setup, routing, transcript, installer, and packed-upgrade coverage.
resolution: null
duplicate_of: null
---
The PR shortcuts prescribe gh stack submit --auto --open unconditionally. Since --open marks new and existing PRs ready for review, updating one draft layer can publish the entire stack. Document state-preserving submission and require explicit intent before opening drafts. Add workflow text coverage.

## Notes

All stack workflows now use gh stack submit --auto by default and reserve --open for explicit user intent, preserving existing draft/review state. Static coverage rejects --auto --open as the default.
