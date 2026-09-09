---
type: is
id: is-01m222ys2fv17vvxnr67rxhwq9
title: Guard comment integrity across sync-branch Git operations
kind: task
status: open
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
delegate: codex-native-comment-git-guards
labels: []
dependencies:
  - type: blocks
    target: is-01m222yt5xq4580v776dnxj8p8
parent_id: is-01m220htdx8tv5k1mpjavfpsca
created_at: 2026-09-09T03:21:33.500Z
updated_at: 2026-09-09T06:08:47.117Z
---
Apply the shared immutable transition guard before all broad staging, commits, fast-forwards, merges, and push retries in sync.ts, file/git.ts, and integration-runner.ts. Separate merge execution from validation, use no-commit/no-ff where reconciliation is required, prevent invariant errors from being swallowed as first-sync or provider-journal failures, and verify every pushed parent edge. Treat attic/comment-conflicts as protected immutable state: inventory and validate raw artifacts and manifests, reject evidence modification or deletion, ignore local Git replacement refs, require non-transforming attributes, and compare exact staged blobs with every planned comment and evidence byte before commit. Cover clean and conflicting mutations, deletions, evidence modify/delete/add-add, add-then-delete history, comment-only first-init races, custom clean filters and autocrlf, and pre-push ancestry.
