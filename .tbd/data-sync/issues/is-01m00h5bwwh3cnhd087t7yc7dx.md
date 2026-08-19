---
type: is
id: is-01m00h5bwwh3cnhd087t7yc7dx
title: "Managed block: roll up in-flight children, actor, and sync time"
kind: feature
status: open
priority: 1
version: 6
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - phase-3
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-14T16:19:56.956Z
updated_at: 2026-08-16T00:13:34.883Z
extensions:
  linear:
    id: e803ebfe-5aed-4bc6-952f-4e5e3448e0e7
    linked_at: 2026-08-16T00:13:34.882Z
---
renderManagedBlock emits 'Children: 12 (3 ready)' — a count that cannot answer 'which of those is someone working on right now, and since when'. Replace with a status breakdown, a bounded list of in-flight children (id, title, actor, claim age), and a synced-at timestamp. Without the timestamp a stale mirror and a quiet project look identical.

Costs nothing: the block is already rewritten on every sync via spliceDescription, and mirror.ts already computes children and readiness across the full store. Self-limiting because only in-flight children are listed.

This is the lever that buys operational visibility without adding Linear issues.

Research: research-2026-08-14-agent-sync-protocol-and-hooks.md §4.3, E4
