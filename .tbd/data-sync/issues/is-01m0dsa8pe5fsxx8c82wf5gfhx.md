---
type: is
id: is-01m0dsa8pe5fsxx8c82wf5gfhx
title: Universal wrapper session adapter (Rivet, bb, or Omnigent)
kind: feature
status: open
priority: 3
version: 5
spec_path: docs/project/specs/active/plan-2026-08-19-agent-session-refs-and-runtimes.md
labels: []
dependencies: []
parent_id: is-01m0drveqd06azafyxnbqx0e4h
created_at: 2026-08-19T19:52:33.741Z
updated_at: 2026-08-20T05:11:04.155Z
extensions:
  linear:
    id: b43e0948-9ed6-4d81-a8cc-34dfe705f9e0
    linked_at: 2026-08-19T23:49:50.174Z
---
All three universal wrappers expose a session id, a status, and an HTTP API, so the
adapter shape is identical and the choice is about which one users actually run.

Rivet Sandbox Agent: cleanest fit, session ids are caller-chosen so the bead id IS the
session id. PROBE THAT FIRST; it is inferred from the README signature and marked
unverified in the research brief Appendix A. Apache-2.0, quiet since 2026-06-19.

bb (get-bb/bb): furthest reach per line of adapter code, because provider-acp makes the
whole ACP registry addressable through one API. Threads have ids, lifecycle state, and
an event stream; HTTP + WebSocket + CLI. MIT, very active. Note its API is
unauthenticated and loopback by default.

Omnigent: most active and broadest on compute (10 sandbox backends including
Kubernetes), self-described alpha. Apache-2.0.

Ship one, keep it opt-in, keep none on the install path.
