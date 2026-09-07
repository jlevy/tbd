---
type: is
id: is-01m1yzxm8735zgxvmxgqy5k5wb
title: create/update --spec accepts a spec on another branch via git lookup; --no-verify
kind: feature
status: open
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-2
dependencies: []
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-07T22:30:46.789Z
updated_at: 2026-09-07T22:31:42.519Z
---
GH #273. validateFileExists (project-paths.ts:182-200) checks the working tree only, so a spec on an unmerged branch fails with 'File not found' and beads whose spec lives on a branch read as missing in every triage. Beads live in a branch-independent store; specs are branch-local; validating against one checkout is a category error. resolveSpecArg falls through to the resolver's git lookup; an on-branch result is accepted with a notice naming the branch. --no-verify on create and update skips existence checks (path still normalized and inside the project) for a spec uncommitted in another worktree. No ref is persisted (branches merge; a stored ref goes stale); doctor and spec status compute 'on branch' at read time. Tryscript: pinned 'Error: File not found' cases at tests/cli-spec-linking.tryscript.md:148, :363, :453 stay for a path on no ref.
