---
type: is
id: is-01m0dsa5x0ptcwtn8rsf7x66q0
title: Add the session ref kind to the bead schema
kind: feature
status: open
priority: 1
version: 7
spec_path: docs/project/specs/active/plan-2026-08-19-agent-session-refs-and-runtimes.md
labels: []
dependencies:
  - type: blocks
    target: is-01m0dsa6915r9gqwt572rgffzy
  - type: blocks
    target: is-01m0dsa6kqmmmt269gx5hfq53y
  - type: blocks
    target: is-01m0dsa79sd5cwpf4jwftec762
  - type: blocks
    target: is-01m0dsa7n1nr69wfbgytp55f9j
parent_id: is-01m0drveqd06azafyxnbqx0e4h
created_at: 2026-08-19T19:52:30.879Z
updated_at: 2026-08-19T23:49:38.347Z
extensions:
  linear:
    id: b7b629d1-3e7d-4801-9d01-28a98b9ace6a
    linked_at: 2026-08-19T23:49:38.347Z
---
Add kind: session to the refs list with fields provider, id, url, actor, started_at. No format bump: refs already exists from f08 with union_by_key merge. Tests must cover the merge under union_by_key including two refs for the same bead from different agents.
