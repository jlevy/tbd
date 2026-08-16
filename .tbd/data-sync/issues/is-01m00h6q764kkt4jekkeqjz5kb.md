---
type: is
id: is-01m00h6q764kkt4jekkeqjz5kb
title: Cache Linear provider meta on disk with a TTL
kind: task
status: open
priority: 3
version: 8
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
assignee: null
labels:
  - sync-efficiency
  - phase-1
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-14T16:20:41.318Z
updated_at: 2026-08-16T02:00:40.583Z
extensions:
  linear:
    id: 8333e756-3ca6-4d5b-8124-18c385622ebd
    linked_at: 2026-08-16T00:13:45.877Z
---
ensureMeta caches on the adapter instance only, so every CLI invocation re-fetches the team's workflow states and label pages — the most expensive query in the set (53 complexity points measured). Cache per team on disk under the gitignored state area with a TTL; cuts roughly a third of the requests from a routine sync and makes frequent syncing comfortably cheap.

Context: a no-op full sync is ~4 GraphQL requests against a measured 2,500 req/hour ceiling, so this is an efficiency win rather than a blocker.

Research: research-2026-08-14-agent-sync-protocol-and-hooks.md §3.3, E8
