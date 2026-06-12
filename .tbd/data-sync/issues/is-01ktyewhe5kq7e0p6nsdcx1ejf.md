---
type: is
id: is-01ktyewhe5kq7e0p6nsdcx1ejf
title: Validate manifest name/kind fields against path traversal
kind: task
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels:
  - pr169-review
dependencies: []
parent_id: is-01ktyesmg1w5p3v0jzt3ryt0zs
created_at: 2026-06-12T17:43:12.581Z
updated_at: 2026-06-12T18:00:18.968Z
closed_at: 2026-06-12T18:00:18.967Z
close_reason: "Fixed upstream in 6b4d266 (S2/S8): isSafeDocName + kind enum + tolerant per-entry manifest parse with warning; unit tests added. Verified empirically: ../../ entry dropped with warning, never acted on (cf5beae)."
---
[Phase 1] PR #169. unforkDoc/updateOne build fs paths from committed manifest name/kind without validation; a hostile forks.yml can direct rm/teleport writes outside the fork dir via ../ names. Reject names containing path separators or .. at manifest read.
