---
type: is
id: is-01kzskxqpat6jdk9ge12wmhayp
title: Confirm off-board expansion reset semantics
kind: task
status: in_progress
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - pr-207
  - client-state
dependencies: []
parent_id: is-01kzscf4fdjf02qjcvedyp7ekx
created_at: 2026-08-11T23:53:31.593Z
updated_at: 2026-08-11T23:55:25.455Z
---
Review thread PRRT_kwDOQ109P86YaURo claims R23 regresses persistence for expansions hidden by filters or the 10,000-row response cap. Verify the pre-R23 client contract, decide whether off-board expansion state should persist, document the disposition at file/function level, and resolve the thread.

## Notes

R24 is not an implementation bug. Git history at de4f1218 proves client.applyControls called setExpanded([]) before every filter/sort change, the pretty-mode handler did likewise, and navigateBoardPage cleared expansion state; hidden expansions were never restored after those UI transitions. For live graph motion, a row absent from the bounded board cannot be mapped to a current display ID, and retaining the old ID would recreate R23, issue stale body requests, and consume the 100-row cap invisibly. Added this explicit lifecycle to the root/package README source, CLI manual, and active design record. Replied to discussion_r3762592219 and resolved thread PRRT_kwDOQ109P86YaURo. Docs commit, push, and exact-head hosted audit remain.
