---
type: is
id: is-01ktyewte7pwwnj5dvhptwjexk
title: Sync drift notice via output layer; update --json needsDecision should carry names
kind: task
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels:
  - pr169-review
dependencies: []
parent_id: is-01ktyesmg1w5p3v0jzt3ryt0zs
created_at: 2026-06-12T17:43:21.799Z
updated_at: 2026-06-12T20:25:44.355Z
closed_at: 2026-06-12T20:25:44.355Z
close_reason: "Done in 3c718c0: fork drift notice renders via output.notice through the shared docs-sync-output module (used by both tbd docs sync and the sync --docs alias); docs update --json needsDecision/skipped now carry structured {name, message} entries. Residual: the invalid-manifest-entry warning in fork-manifest.ts (file layer) still writes stderr directly — no OutputManager at that layer; acceptable."
---
[Phase 3] PR #169. sync.ts notifyForkDrift writes process.stderr.write directly, bypassing the output/style layer the spec mandates; docs update --json returns prose strings in needsDecision instead of doc names (parse-unfriendly for agents).
