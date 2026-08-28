---
type: is
id: is-01m1512sk5atraw6pf7nshsgrx
title: Sync silently resets a deferred bead to open while the tracker still carries tbd:deferred
kind: bug
status: open
priority: 1
version: 1
spec_path: docs/project/specs/active/plan-2026-08-28-sync-convergence-and-stability.md
labels: []
dependencies: []
parent_id: is-01m14yzbwwg92e5k7z7d4kyn00
created_at: 2026-08-28T20:30:49.445Z
updated_at: 2026-08-28T20:30:49.445Z
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
