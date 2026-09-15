---
type: is
id: is-01ktycs43se7t1pbz1vrtbdddx
title: "Review/S5: CRLF fork file causes spurious whole-file conflict on update (merge inputs not LF-normalized)"
kind: bug
status: closed
priority: 2
version: 4
spec_path: docs/project/specs/done/plan-2026-06-11-forkable-docs.md
labels: []
dependencies: []
parent_id: is-01ktxg3eqj62dhphs6dnbb30jf
created_at: 2026-06-12T17:06:23.481Z
updated_at: 2026-09-14T04:20:34.607Z
closed_at: 2026-06-12T17:45:35.820Z
close_reason: "Fixed in 6b4d266: mergeContents LF-normalizes all three inputs before git merge-file. Test in fork-update.test.ts (CRLF fork vs LF base/upstream)."
---
