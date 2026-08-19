---
type: is
id: is-01m0c5rsgkvdv8ad02eaq7109k
title: "Phase 3: publishing delegates to Linear"
kind: task
status: open
priority: 3
version: 1
spec_path: docs/project/specs/active/plan-2026-08-18-actor-axis-and-identity.md
labels: []
dependencies: []
parent_id: is-01m0c5r461zmx3ctgsxq94s0bq
created_at: 2026-08-19T04:51:43.762Z
updated_at: 2026-08-19T04:51:43.762Z
---
agent_map in config; outbound delegate to delegateId only for agents named there, which is what keeps ephemeral session identities out of a shared workspace by construction. Inbound delegate maps through agent_map in reverse; an unknown app user warns and leaves the bead unchanged.

An unmapped agent delegate produces a reported skip, never a silent one. A human delegate is never sent to Linear, since Linear delegates are agents only.

Depends on Phase 1's field. Independent of Phase 2.
