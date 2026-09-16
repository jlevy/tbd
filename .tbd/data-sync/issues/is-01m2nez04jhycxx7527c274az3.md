---
type: is
id: is-01m2nez04jhycxx7527c274az3
title: Generate gh skill installers for the owning agent surface
kind: bug
status: in_progress
priority: 1
version: 2
delegate: codex@spud10
labels:
  - stacked-prs
  - setup
dependencies: []
hold: null
hold_until: null
created_at: 2026-09-16T15:56:57.874Z
updated_at: 2026-09-16T15:57:15.730Z
started_at: 2026-09-16T15:57:15.729Z
---
The Codex ensure-gh-cli script is byte-identical to the Claude script and defaults GH_SKILL_AGENT to claude-code, so it can report success while Codex lacks gh-stack. Generate each installed script with the correct agent identifier and test both outputs.
