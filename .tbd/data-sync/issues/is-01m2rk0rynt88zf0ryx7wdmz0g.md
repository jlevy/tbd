---
type: is
id: is-01m2rk0rynt88zf0ryx7wdmz0g
title: "PR #307 A3: regression test sits in a Windows-skipped, unrelated suite"
kind: bug
status: closed
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
delegate: claude-code@spud10.local
labels: []
dependencies: []
parent_id: is-01m2rk07a26hew8fzbz8njv6r4
hold: null
hold_until: null
created_at: 2026-09-17T21:05:33.652Z
updated_at: 2026-09-17T21:47:09.487Z
started_at: 2026-09-17T21:46:46.247Z
closed_at: 2026-09-17T21:47:09.486Z
close_reason: "fixed in 16df8995: moved to packages/tbd/tests/doctor-orphaned-dependencies.test.ts, which runs on every platform; only the read-only-directory and worktree-surgery cases skip Windows, each with its reason."
resolution: null
duplicate_of: null
---
Low. packages/tbd/tests/common-dir-layout-doctor.test.ts:102-172 lives under describeUnlessWindows and inside the doctor --fix (H3) layout group. Move to a platform-neutral doctor suite. Review A: https://github.com/jlevy/tbd/pull/307#pullrequestreview-5238514945
