---
type: is
id: is-01m1yzy2kx8zrv658fwh0g4dqe
title: Rewrite update-specs-status to use tbd spec status, list --children and spec move; pin it with a test
kind: task
status: open
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-5
dependencies: []
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-07T22:31:01.498Z
updated_at: 2026-09-07T22:31:46.974Z
---
GH #274. Two instructions are wrong in practice: update-specs-status.md:154-161 says bare filenames survive a move (the reporter needed 33 bare or ./ sibling rewrites across 48 files), and :233-238 says to read the committed bead files under the data-sync worktree, contradicting the skill's 'you operate tbd' rule. Step 2's triage input becomes tbd spec status --json and tbd list --type epic --children --json; the link passage becomes 'use tbd spec move, then confirm with tbd spec status'; remove the read-bead-files step and the id-space warning (:239-243); the 'missing from disk' row (:64) becomes the on-branch state. Test in the shape of tests/watch-beads-shortcut.test.ts: the shortcut names no path under the data-sync worktree, and every tbd command it mentions parses (tbd <cmd> --help exits 0). Two byte-identical copies exist (.tbd/docs and dist/docs); edit the source under packages/tbd/docs.
