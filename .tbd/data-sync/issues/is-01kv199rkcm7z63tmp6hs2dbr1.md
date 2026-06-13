---
type: is
id: is-01kv199rkcm7z63tmp6hs2dbr1
title: "Query-driven mutation: close/update --where (reuse list grammar)"
kind: task
status: open
priority: 3
version: 1
spec_path: docs/project/specs/active/plan-2026-06-13-agent-cli-ergonomics.md
labels: []
dependencies: []
parent_id: is-01kv197ns6jwkg2q82w7awjn15
created_at: 2026-06-13T20:03:17.740Z
updated_at: 2026-06-13T20:03:17.740Z
---
Phase 2 (spec problems P2/P8). Add --where to close/update/reopen reusing the existing list filter grammar; always print the matched set and count first; require --yes above a small threshold or --dry-run to preview. Reuses and depends on the list query DSL tracked separately as tbd-mvus (Query DSL for list).
