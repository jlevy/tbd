---
type: is
id: is-01kv199rkcm7z63tmp6hs2dbr1
title: "Query-driven mutation: close/update --where (reuse list grammar)"
kind: task
status: open
priority: 3
version: 3
spec_path: docs/project/specs/active/plan-2026-06-13-agent-cli-ergonomics.md
labels: []
dependencies: []
parent_id: is-01kv197ns6jwkg2q82w7awjn15
created_at: 2026-06-13T20:03:17.740Z
updated_at: 2026-08-10T21:54:33.759Z
extensions:
  linear:
    id: 1f760527-47c0-47a2-8e1a-01b086c6eb05
    key: TBD-12
    url: https://linear.app/finterm-ai/issue/TBD-12/query-driven-mutation-closeupdate-where-reuse-list-grammar
    linked_at: 2026-08-10T19:37:20.243Z
---
Phase 2 (spec problems P2/P8). Add --where to close/update/reopen reusing the existing list filter grammar; always print the matched set and count first; require --yes above a small threshold or --dry-run to preview. Reuses and depends on the list query DSL tracked separately as tbd-mvus (Query DSL for list).
