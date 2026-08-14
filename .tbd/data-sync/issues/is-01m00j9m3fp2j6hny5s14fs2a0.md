---
type: is
id: is-01m00j9m3fp2j6hny5s14fs2a0
title: Fetch Linear comments only for pairs the delta moved (cost is 2+N requests per sync)
kind: bug
status: open
priority: 1
version: 2
labels:
  - sync-efficiency
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-14T16:39:45.007Z
updated_at: 2026-08-14T16:40:23.376Z
---
MEASURED, no-op steady-state sync against the mock server:

  3 linked beads,  comments=two_way (default): 5 requests  (TeamMeta, IssuesUpdatedSince, IssueComments x3)
  10 linked beads, comments=two_way (default): 12 requests (TeamMeta, IssuesUpdatedSince, IssueComments x10)
  10 linked beads, comments=off:               2 requests

So per-sync cost is 2+N where N is the number of linked beads; the comment fetch is the entire slope. Against the 2,500 req/hour ceiling measured on a live key (research-2026-08-09-linear-task-surfaces.md §1.2), this repo's projected 70-bead mirror allows ~34 syncs/hour across EVERYONE sharing that key, and the current 114-bead selection allows ~21.

Fix: a pair whose provider updatedAt has not advanced past the recorded remote_updated_at cannot have a new comment — Linear bumps updatedAt on comment creation. The delta is already in hand at that point in the run (sync-engine.ts:513-560), so restrict the comment fetch to pairs present in the delta, plus pairs with locally authored comments pending push. Quiet mirrors then cost a flat 2 requests at any size.

Prove the updatedAt-on-comment assumption in the live QA runner first. If it does not hold, fall back to a periodic full comment reconcile (hourly) rather than per-sync polling.

Research: research-2026-08-14-agent-sync-protocol-and-hooks.md F10, §1.7, E11
