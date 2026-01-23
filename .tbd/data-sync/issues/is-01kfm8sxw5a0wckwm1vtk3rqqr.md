---
created_at: 2026-01-23T01:51:51.172Z
dependencies: []
id: is-01kfm8sxw5a0wckwm1vtk3rqqr
kind: task
labels: []
priority: 1
status: open
title: Update SKILL.md to clarify prefix requirement
type: is
updated_at: 2026-01-23T01:51:51.172Z
version: 1
---
Update the agent instructions (SKILL.md and related docs) to make it clear that --prefix is required unless migrating from beads.

Files to modify:
- packages/tbd/src/docs/SKILL.md
- docs/SKILL.md (repo-level copy)
- packages/tbd/src/docs/CURSOR.mdc
- README.md (if it mentions setup without prefix)

Changes needed:
- Update the one-liner installation command to include --prefix example
- Clarify that agents MUST provide --prefix when running tbd setup --auto
- Document that beads migration is the ONLY case where prefix is auto-detected (from existing beads config)
- Add clear error message guidance: if prefix error occurs, agent should ask user for a project prefix name

Example updated one-liner:
  npm install -g tbd-git@latest && tbd setup --auto --prefix=<project-name>

Alternative: Keep the simple one-liner but document that --prefix is required and setup will fail with helpful message if not provided.
