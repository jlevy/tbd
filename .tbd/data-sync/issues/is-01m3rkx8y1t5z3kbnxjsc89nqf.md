---
type: is
id: is-01m3rkx8y1t5z3kbnxjsc89nqf
title: Prepare v0.10.0 release candidate stacked on README PR313
kind: task
status: in_progress
priority: 1
version: 3
delegate: claude-code@spud10.local
labels: []
dependencies: []
hold: null
hold_until: null
created_at: 2026-09-30T07:36:49.343Z
updated_at: 2026-09-30T07:49:41.365Z
started_at: 2026-09-30T07:37:43.900Z
---
Prepare the next minor release using docs/publishing.md: inventory v0.9.0 delta and blockers; update version/changelog; audit dependencies; run package, upgrade, downstream, metadata and CI gates; create and formally link an upper PR to #313. User requires final review before tag/publish; do not merge, tag, publish, or enable automatic release. Record exact candidate evidence and remaining post-approval steps.

## Notes

Candidate scope: v0.9.0 through README #313 plus release prep and two confirmed data-preservation fixes (tbd-d2bp Codex hook ownership/unsafe-target refusal; tbd-mr8s prunable worktree backup/refusal). Both have red/green focused evidence (51 tests before collision follow-up). Explicitly deferred: tbd-b24q development-only advisories (runtime audit clean, lockfile unchanged); tbd-fnwc pre-existing hook PATH/visibility work; remaining bcss/3eui epics are not blanket release gates; native comments/f09 and open PR253 Workmap, PR174 alternative README, PR21 plan design excluded. Downstream tryscript base 1ffbe8fa passes code/package/tests; full verify ends at 6 pre-existing dev advisories. No merge/tag/publish before user final review. Evidence directory /Users/levy/wrk/release-evidence/tbd-v0.10.0.
