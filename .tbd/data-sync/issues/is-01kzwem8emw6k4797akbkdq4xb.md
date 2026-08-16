---
type: is
id: is-01kzwem8emw6k4797akbkdq4xb
title: Add composable sorting to every bead column
kind: feature
status: closed
priority: 1
version: 3
labels:
  - web
  - release-readiness
dependencies: []
parent_id: is-01kzw6y8ppmp6bt6nd8tgmmspn
created_at: 2026-08-13T02:18:41.491Z
updated_at: 2026-08-13T02:43:16.135Z
closed_at: 2026-08-13T02:43:16.135Z
close_reason: "Implemented, documented, code-reviewed, covered by focused and full-suite tests, benchmarked at 10,001 rows, and validated in the rebuilt live browser on PR #209."
---
Make ID, priority, kind, title, updated, and labels column headers interactive and keyboard-accessible sort controls. Each click promotes that column to the primary sort key while retaining prior keys as ordered tie-breakers (for example: click Updated, then Priority => Priority primary and Updated secondary). Repeated clicks toggle that key's direction without discarding the remaining key stack. Define deterministic natural/lexicographic comparison for literals, case-folded text, label lists, and timestamps; retain ID as a final stable tie-breaker. Reflect the active ordered stack and directions in header affordances and accessibility metadata, document the rule in the co-located CSS design system, and cover pure sorting, state/query behavior, rendering, and live-browser interaction.
