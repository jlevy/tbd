---
type: is
id: is-01m2rqc66m2r6ybk22yhjeh7xx
title: "PR #307 (unmarked, cursor[bot] comment 4041837067) 1: stale invalid-file snapshot after orphan repair"
kind: bug
status: closed
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
delegate: claude-code@spud10.local
labels: []
dependencies: []
parent_id: is-01m2r1s6skhxtw7573hhyg62jr
hold: null
hold_until: null
created_at: 2026-09-17T22:21:41.971Z
updated_at: 2026-09-17T22:21:48.528Z
started_at: 2026-09-17T22:21:48.182Z
closed_at: 2026-09-17T22:21:48.527Z
close_reason: "fixed in e4b10ed0: OrphanRepairOutcome carries the invalid files of the same locked listing as its issues; repairOrphanedDependencies assigns both fields together, as every other reload in run() does, and the re-diagnosis takes both from that listing. Confirmed by 'reports the store the repair decided from, not the pre-lock snapshot' (holds the writer lock, conflicts a target file while doctor blocks, then asserts the kept edge is reported as target-present-but-invalid and Issue validity names the file); fails at cdc21711 with '1 orphaned reference(s); removed 1 orphaned reference(s)'."
resolution: null
duplicate_of: null
---
Low. packages/tbd/src/cli/commands/doctor.ts: the orphan repair set this.issues from the locked re-read but left this.invalidIssueFiles as the pre-lock snapshot, and the post-repair re-diagnosis used that stale list, so a target that became unreadable between the snapshot and the lock is kept by the repair and then reported as a missing orphan, while Issue validity says nothing about the file. Unmarked inline review comment: https://github.com/jlevy/tbd/pull/307#discussion_r4041837067
