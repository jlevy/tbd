---
type: is
id: is-01ktyeybnvxd1m52samvt280k9
title: "tbd-docs.md: first-principles Managing Docs chapter"
kind: task
status: open
priority: 1
version: 1
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels:
  - pr169-review
dependencies: []
parent_id: is-01ktyesp3hmzqdxdg3zs79tjhz
created_at: 2026-06-12T17:44:12.219Z
updated_at: 2026-06-12T17:44:12.219Z
---
[Phase 0.2] PR #169. New chapter opening with the two-mode model: hidden cache (default; gitignored .tbd/docs/, always active, zero repo footprint) vs forked (tracked docs/tbd/, visible on GitHub, editable, mergeable) - both serve the same guidelines; forking adds visibility/editability. Then the scope axis (all vs by category), the command reference for fork/unfork/status/update/diff/list (currently undocumented in the manual), the doc-states table, and the update decision table. Per the spec Documentation Contract row; cross-link docref-format and docmap-format when they exist.
