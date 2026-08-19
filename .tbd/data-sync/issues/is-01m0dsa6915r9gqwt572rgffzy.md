---
type: is
id: is-01m0dsa6915r9gqwt572rgffzy
title: tbd start writes a local session ref
kind: feature
status: open
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-19-agent-session-refs-and-runtimes.md
labels: []
dependencies:
  - type: blocks
    target: is-01m0dsa9djn6h3k1fg60nqfgs4
parent_id: is-01m0drveqd06azafyxnbqx0e4h
created_at: 2026-08-19T19:52:31.264Z
updated_at: 2026-08-19T23:48:38.044Z
extensions:
  linear:
    id: 520e1b4d-5520-4fdb-9aef-371431076375
    linked_at: 2026-08-19T23:48:38.044Z
---
On claim, write a session ref with provider 'local', the harness session id where detectable, a minted id where not, the actor from resolveAgentIdentity, and started_at. This is the degenerate case that makes the feature useful with no adapter and no network.
