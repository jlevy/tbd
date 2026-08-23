---
type: is
id: is-01m0dsa6kqmmmt269gx5hfq53y
title: Session status map in local state, with the derived stale rule
kind: feature
status: open
priority: 1
version: 6
spec_path: docs/project/specs/active/plan-2026-08-19-agent-session-refs-and-runtimes.md
labels: []
dependencies:
  - type: blocks
    target: is-01m0dsa6yx7pcwybmmspf947q2
  - type: blocks
    target: is-01m0dsa808f6p2yfvdrabw53qq
parent_id: is-01m0drveqd06azafyxnbqx0e4h
created_at: 2026-08-19T19:52:31.606Z
updated_at: 2026-08-20T20:10:53.850Z
extensions:
  linear:
    id: c600ba31-b457-4a7f-b309-6096a816bb50
    linked_at: 2026-08-19T23:49:42.660Z
---
Volatile status and updated_at live in .tbd/state.yml (local, untracked), not on the
bead, so a status poll never produces a commit. Derive 'stale' locally when updated_at
passes a threshold; stale wins over whatever the provider last reported.

Refresh design, verified against bb's tasks plugin source (attic/bb, plugins/tasks/lifecycle/index.ts):
- Events first where a push channel exists, reconciliation as the low-frequency backstop.
- Reconcile only non-terminal refs; settled sessions cost nothing.
- Terminal statuses are sticky: once done/failed, never transitioned again.
- bb's cadences for reference: 5 min reconcile when links are live, 60 s idle poll otherwise.

One deliberate divergence from bb: bb maps a session its API can no longer find to
'completed'. tbd maps it to 'stale'. A vanished session may equally have crashed, and
guessing optimistically about liveness is the failure mode that destroys trust.
