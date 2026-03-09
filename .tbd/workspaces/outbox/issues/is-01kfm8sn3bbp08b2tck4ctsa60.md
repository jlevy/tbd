---
close_reason: Spec updates completed - removed prefix auto-detection references
closed_at: 2026-01-23T02:11:25.412Z
created_at: 2026-01-23T01:51:42.186Z
dependencies: []
id: is-01kfm8sn3bbp08b2tck4ctsa60
kind: task
labels: []
priority: 1
status: closed
title: Remove prefix auto-detection from spec
type: is
updated_at: 2026-03-09T02:47:23.204Z
version: 7
---
Update the design spec to remove all references to prefix auto-detection feature.

Files to modify:
- docs/project/specs/active/plan-2026-01-20-streamlined-init-setup-design.md
- docs/project/specs/active/valid-2026-01-20-streamlined-init-setup-design.md

Sections to update/remove:
- Prefix Auto-Detection Algorithm section
- References to auto-detecting prefix from git remote URL
- References to falling back to directory name
- Phase 1 completion checklist item about prefix detection
- Any examples showing auto-detected prefix behavior

Keep:
- Beads prefix extraction for migration (still valid use case)
- normalizePrefix and isValidPrefix descriptions (still used for validation)
