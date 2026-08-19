---
type: is
id: is-01m0dsa6kqmmmt269gx5hfq53y
title: Session status map in local state, with the derived stale rule
kind: feature
status: open
priority: 1
version: 5
spec_path: docs/project/specs/active/plan-2026-08-19-agent-session-refs-and-runtimes.md
labels: []
dependencies:
  - type: blocks
    target: is-01m0dsa6yx7pcwybmmspf947q2
  - type: blocks
    target: is-01m0dsa808f6p2yfvdrabw53qq
parent_id: is-01m0drveqd06azafyxnbqx0e4h
created_at: 2026-08-19T19:52:31.606Z
updated_at: 2026-08-19T23:49:42.660Z
extensions:
  linear:
    id: c600ba31-b457-4a7f-b309-6096a816bb50
    linked_at: 2026-08-19T23:49:42.660Z
---
Volatile status and updated_at live in .tbd/state.yml (local, untracked), not on the bead, so a status poll never produces a commit. Derive 'stale' locally when updated_at passes a threshold; stale wins over whatever the provider last reported.
