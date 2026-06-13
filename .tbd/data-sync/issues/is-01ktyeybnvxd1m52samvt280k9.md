---
type: is
id: is-01ktyeybnvxd1m52samvt280k9
title: "tbd-docs.md: first-principles Managing Docs chapter"
kind: task
status: closed
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels:
  - pr169-review
dependencies: []
parent_id: is-01ktyesp3hmzqdxdg3zs79tjhz
created_at: 2026-06-12T17:44:12.219Z
updated_at: 2026-06-12T20:25:52.979Z
closed_at: 2026-06-12T20:25:52.979Z
close_reason: "Done in e5ce028: 'Managing Docs: Two Modes' chapter in tbd-docs.md — hidden cache vs forked from first principles, equivalence statement, command lifecycle — ahead of the existing drift table; Documentation Commands section already carries the full tbd docs group reference."
---
[Phase 0.2] PR #169. New chapter opening with the two-mode model: hidden cache (default; gitignored .tbd/docs/, always active, zero repo footprint) vs forked (tracked docs/tbd/, visible on GitHub, editable, mergeable) - both serve the same guidelines; forking adds visibility/editability. Then the scope axis (all vs by category), the command reference for fork/unfork/status/update/diff/list (currently undocumented in the manual), the doc-states table, and the update decision table. Per the spec Documentation Contract row; cross-link docref-format and docmap-format when they exist.
