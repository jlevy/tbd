---
type: is
id: is-01kv197ns6jwkg2q82w7awjn15
title: "Spec: Agent CLI ergonomics (bulk ops, output contract, sync clarity)"
kind: epic
status: open
priority: 1
version: 11
spec_path: docs/project/specs/active/plan-2026-06-13-agent-cli-ergonomics.md
labels: []
dependencies: []
child_order_hints:
  - is-01kv199g5s0k58f2r5d0kcj9kb
  - is-01kv199hk1mhj4qq0c1rhhkh31
  - is-01kv199k01p0jmd2mh24v00aar
  - is-01kv199mceva1eqhc1xd45ntxe
  - is-01kv199ns2s6hs8zzxxf6vwkz5
  - is-01kv199q7mbcqxrvfd6jpecxnk
  - is-01kv199rkcm7z63tmp6hs2dbr1
  - is-01kv199t0v53178ybga0kp21k3
  - is-01kv199vg79cyyjde19bxgrvdg
  - is-01kv1b1bbc8zjprnm79nqyaeh4
created_at: 2026-06-13T20:02:09.317Z
updated_at: 2026-06-13T20:33:39.180Z
---
Improve tbd CLI ergonomics for agents per the spec. Replaces brittle agent bash (for-loops over issue IDs, 2>&1 | tail -1, hand-rolled echo headers, the --no-sync then tbd sync ritual) with bulk/multi-target verbs, a trustworthy output contract, and an honest stage-then-publish sync model. Phase 1 = backward-compatible quick wins for the current release; Phase 2 = query-driven mutation and a tbd apply transaction file. Supersedes/absorbs stub bead tbd-cxqm (Batch operations); relates to tbd-mvus (Query DSL for list) and tbd-tv5i (Format option).
