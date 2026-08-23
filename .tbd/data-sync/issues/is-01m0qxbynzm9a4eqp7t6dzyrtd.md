---
type: is
id: is-01m0qxbynzm9a4eqp7t6dzyrtd
title: "R10: fix buffered flush and conditional durability guidance"
kind: bug
status: in_progress
priority: 2
version: 2
spec_path: docs/project/reviews/review-2026-08-23-pr258-holistic-engineering-guidelines.md
labels: []
dependencies: []
parent_id: is-01m0qxb2r48hpyfvzbpbcrnh3w
created_at: 2026-08-23T18:15:47.646Z
updated_at: 2026-08-23T18:16:10.627Z
---
PR #258 review R10. Correct the NamedTempFile/BufWriter sequence and make file and parent-directory sync conditional on the declared durability contract.
