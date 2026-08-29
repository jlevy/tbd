---
type: is
id: is-01m1512sk5atraw6pf7nshsgrx
title: Sync silently resets a deferred bead to open while the tracker still carries tbd:deferred
kind: bug
status: closed
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-08-28-sync-convergence-and-stability.md
labels: []
dependencies: []
parent_id: is-01m14yzbwwg92e5k7z7d4kyn00
created_at: 2026-08-28T20:30:49.445Z
updated_at: 2026-08-29T02:31:49.346Z
closed_at: 2026-08-29T02:31:49.346Z
close_reason: |-
  NOT A DEFECT. I filed this on a contaminated reproduction and the product is correct; correcting the record.

  The mock server's issueCreate handler applied title, description, priority, projectId, assignee, delegate, parent and labelIds, but silently ignored input.stateId. Every created issue therefore landed in the mock's default Todo state (type unstarted) no matter what the adapter asked for. statusFromLinear maps unstarted to open unconditionally, so a bead pushed as deferred read back as open. That is what I observed and mistook for silent data loss.

  Verified the adapter's half directly by capturing the create mutation input: it sends stateId 'state-backlog' for a deferred bead, which is exactly right. Real Linear honors it.

  With the mock corrected to apply stateId on create, all four statuses (open, in_progress, blocked, deferred) round-trip and settle immediately: deferred stays deferred in Backlog carrying tbd:deferred, blocked stays blocked in In Progress carrying tbd:blocked. No drift across repeated syncs.

  The mock gap was a real test-infrastructure defect and is fixed in the same commit: it had silently defeated status round-trip coverage for three of the four statuses. Confirmed by reverting the mock fix and watching the new round-trip test fail for in_progress, blocked and deferred. Locked in by 'round-trips %s through the tracker and settles' in tests/integrations-sync-engine.test.ts.
resolution: null
duplicate_of: null
---
REPRODUCED against the mock server on 2026-08-28 while probing GH #265. Silent local data loss, distinct from the convergence defects: this one settles, which is what makes it worse.

Repro: a bead with status: deferred, outbound statuses including deferred, mirrorLabels none, originLabels ['tbd']. Run the sync repeatedly:

  run0: beadStatus=deferred quiet=false remoteState=Todo remoteLabels=tbd:deferred|tbd
  run1: beadStatus=deferred quiet=true  remoteState=Todo remoteLabels=tbd:deferred|tbd
  run2: beadStatus=open     pull=1 push=1 remoteState=Todo remoteLabels=tbd:deferred|tbd
  run3: beadStatus=open     quiet=true  remoteState=Todo remoteLabels=tbd:deferred|tbd

The push is correct: Linear has no deferred state, so tbd projects deferred as state Todo plus the carrier label tbd:deferred, exactly as designed. The pull is not: on run2 the engine reads the remote back, maps Todo to open, and overwrites the bead's deferred with open. The carrier label is right there on the issue and is what statusFromLinear(stateType, labels) exists to read, but the resulting status still comes back open. Nobody touched the tracker; the round trip itself loses the value, then goes quiet, so the loss is permanent and unreported.

Same shape for blocked is worth checking in the same pass (blocked also round-trips through a carrier label). Note the deferred case is doubly bad next to tbd-5av0: a bead that was deliberately deferred silently rejoins the open backlog.

Investigate statusFromLinear and the carrier-label read path in packages/tbd/src/integrations/linear/mapping.ts, and why the value survives run1 but not run2 (run2 is the first run whose delta actually re-reads the issue). Needs a red-green test asserting deferred and blocked survive N syncs untouched.
