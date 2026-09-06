---
type: is
id: is-01m0dsa5x0ptcwtn8rsf7x66q0
title: Add the session ref kind to the bead schema
kind: feature
status: open
priority: 1
version: 10
spec_path: docs/project/specs/active/plan-2026-08-19-agent-session-refs-and-runtimes.md
docs:
  - path: docs/project/research/current/research-2026-09-06-bead-agent-coordination.md
    role: research
  - path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
    role: design
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
updated_at: 2026-09-06T19:49:00.447Z
extensions:
  linear:
    id: b7b629d1-3e7d-4801-9d01-28a98b9ace6a
    linked_at: 2026-08-19T23:49:38.347Z
---
Add session references with provider, stable session id, optional URL, actor, and start time, after deciding schema compatibility and merge identity. September 6 source review corrects the old no-format-bump assumption: IssueRef currently requires URL, strips unknown nested fields, and merges by URL. Outer issue f08 passthrough does not protect this shape. Specify a stable namespaced session key, alias/URL changes, same-ID divergent content handling, and old-client behavior; prove preservation or define a format/migration boundary. Tests must cover URL-less local refs, two sessions with absent/shared URLs, old-reader read/write/merge/recovery, and different agents attaching refs to one bead. Coordinate invocation identity with tbd-6nmq. Governing runtime plan retains durable ref, volatile status, and bridge projection lifetimes; no runtime vendor decision is required.
