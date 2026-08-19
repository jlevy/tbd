---
type: is
id: is-01m0c5rsgkvdv8ad02eaq7109k
title: "Phase 3: publishing delegates to Linear"
kind: task
status: closed
priority: 3
version: 5
spec_path: docs/project/specs/active/plan-2026-08-18-actor-axis-and-identity.md
labels: []
dependencies:
  - type: blocks
    target: is-01m0c8v94j74sqaj35ts5xrjjf
parent_id: is-01m0c5r461zmx3ctgsxq94s0bq
created_at: 2026-08-19T04:51:43.762Z
updated_at: 2026-08-19T20:01:58.733Z
closed_at: 2026-08-19T20:01:58.732Z
close_reason: "Actor Phase 3 landed in 9acec7a8: agent_map in config with UUID validation at construction; outbound delegate -> delegateId only for mapped agents; inbound maps through agent_map in reverse and reads an unknown app user as no delegate rather than inventing a name; unmapped agent produces a reported field-level skip; canPushDelegate(null) is false, inheriting the OS-351 rule. Mock server grows a separate appUsers roster because Linear delegates are app users, never people. 6 tests."
resolution: null
duplicate_of: null
extensions:
  linear:
    id: 175d3536-7308-4798-9871-5553ccc54d6f
    linked_at: 2026-08-19T16:27:22.938Z
---
agent_map in config; outbound delegate to delegateId only for agents named there, which is what keeps ephemeral session identities out of a shared workspace by construction. Inbound delegate maps through agent_map in reverse; an unknown app user warns and leaves the bead unchanged.

An unmapped agent delegate produces a reported skip, never a silent one. A human delegate is never sent to Linear, since Linear delegates are agents only.

Depends on Phase 1's field. Independent of Phase 2.
