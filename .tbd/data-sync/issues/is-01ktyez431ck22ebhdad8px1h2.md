---
type: is
id: is-01ktyez431ck22ebhdad8px1h2
title: "tbd docs list --json: emit source for upstream entries"
kind: task
status: closed
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels:
  - pr169-review
dependencies: []
parent_id: is-01ktyessevb2mdcafd12z7670n
created_at: 2026-06-12T17:44:37.216Z
updated_at: 2026-06-12T18:20:47.543Z
closed_at: 2026-06-12T18:20:47.543Z
close_reason: "Fixed in a3a5b37: list --json emits source for upstream entries and path for locals. Verified empirically: 27/27 entries located, all upstream entries carry source."
---
PR #169 review sec 3/4. docs-fork.ts:573-581 emits upstream entries with neither path nor source; the internal: source is already computed for forking. Emit it so every docmap entry is locatable and the output is consumable as a real inventory by third parties.
