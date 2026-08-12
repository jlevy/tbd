---
type: is
id: is-01kzskxqpat6jdk9ge12wmhayp
title: Confirm off-board expansion reset semantics
kind: task
status: closed
priority: 2
version: 4
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - pr-207
  - client-state
dependencies: []
parent_id: is-01kzscf4fdjf02qjcvedyp7ekx
created_at: 2026-08-11T23:53:31.593Z
updated_at: 2026-08-12T00:09:10.787Z
closed_at: 2026-08-12T00:09:10.786Z
close_reason: Reviewed as non-actionable by design; lifecycle documented in 2a7a7d44 and PR thread resolved.
---
Review thread PRRT_kwDOQ109P86YaURo claims R23 regresses persistence for expansions hidden by filters or the 10,000-row response cap. Verify the pre-R23 client contract, decide whether off-board expansion state should persist, document the disposition at file/function level, and resolve the thread.

## Notes

R24 disposition complete in 2a7a7d44. Historical code proves filters, sort, pretty mode, and page changes already cleared expansion state before R23. Live rows absent from the bounded response cannot be assigned a current display ID; retaining the old ID would recreate stale requests and invisibly consume the expansion cap. README, manual, and design record now say this explicitly. Replied to discussion_r3762592219 and resolved the thread. Final run 31548603423 is green.
