---
type: is
id: is-01m4mc5v1s32vcb294km4ybchc
title: Isolate historical dependencies in packed upgrade proof
kind: bug
status: open
priority: 1
version: 1
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
delegate: sol-pr324-fixes-01a127df
labels: []
dependencies: []
parent_id: is-01m4manp9y8srxqpyce3sbq1xe
created_at: 2026-10-11T02:20:25.528Z
updated_at: 2026-10-11T02:20:25.528Z
---
PR #324 head 845d55c: Ubuntu Node 24 passed 3045 tests but packed upgrade proof failed. extractPackage symlinks current dependencies into historical packages; old baseline imports removed gray-matter. Repair baseline dependency setup without restoring vulnerable production dependencies. Queued for sole writer after Astra review window. Evidence: actions run 38104346646 job 114366547604; external scratch ubuntu24-ci.log.
