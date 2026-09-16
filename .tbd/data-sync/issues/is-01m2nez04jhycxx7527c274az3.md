---
type: is
id: is-01m2nez04jhycxx7527c274az3
title: Generate gh skill installers for the owning agent surface
kind: bug
status: closed
priority: 1
version: 4
delegate: codex@spud10
labels:
  - stacked-prs
  - setup
dependencies: []
hold: null
hold_until: null
created_at: 2026-09-16T15:56:57.874Z
updated_at: 2026-09-16T16:53:58.042Z
started_at: 2026-09-16T15:57:15.729Z
closed_at: 2026-09-16T16:53:58.042Z
close_reason: Implemented with focused setup, routing, transcript, installer, and packed-upgrade coverage.
resolution: null
duplicate_of: null
---
The Codex ensure-gh-cli script is byte-identical to the Claude script and defaults GH_SKILL_AGENT to claude-code, so it can report success while Codex lacks gh-stack. Generate each installed script with the correct agent identifier and test both outputs.

## Notes

Setup now renders Claude and Codex ensure scripts for their owning agent targets. Generated surfaces were refreshed; setup tests, identity collision tests, and packed upgrade validation pass.
