---
type: is
id: is-01ktyew3gxapke0xevza7ssr5z
title: docs status recommends nonexistent --category flag (golden-tested)
kind: bug
status: closed
priority: 0
version: 2
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels:
  - pr169-review
dependencies: []
parent_id: is-01ktyesmg1w5p3v0jzt3ryt0zs
created_at: 2026-06-12T17:42:58.332Z
updated_at: 2026-06-12T17:51:57.576Z
closed_at: 2026-06-12T17:51:57.576Z
close_reason: "Fixed upstream in 6b4d266 (D3): hint now 'tbd docs fork <name>' / '--all'; tryscript updated. Verified empirically against built CLI at cf5beae."
---
[Phase 4] PR #169. docs-fork.ts:357 zero-fork status prints 'tbd docs fork --category=general' which errors with unknown option (verified); cli-docs-fork.tryscript.md:36 pins the hint as correct output. Fix: implement --category selection from doc frontmatter (spec Phase 4 item 15) or change the hint to name-based forking until then.
