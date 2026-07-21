---
type: is
id: is-01ky1faet7db4x0ppzt5tryrk1
title: "PR #196 review R3: snapshot reads spawn O(2N) git show processes per report"
kind: task
status: deferred
priority: 2
version: 2
labels:
  - pr196-review
dependencies: []
parent_id: is-01ky1f9xcbb3qas6ex5v7hda0k
created_at: 2026-07-21T04:35:37.415Z
updated_at: 2026-07-21T04:48:30.143Z
---
readSnapshot runs one git show per issue per endpoint (sync-branch-changes.ts:43-69) and baseline-advance re-runs a full report on every unrelated movement (bead-watch.ts:138-146) — ~900 spawns/tick at 450 beads; costly on Windows. Fix later: git cat-file --batch blob streaming, and/or narrow parsing to git diff --name-only changed paths when the selection does not need full graphs (all/beads/label/spec/status without --ready). DEFERRED: perf hardening before large-repo adoption; not blocking Phase 1.
