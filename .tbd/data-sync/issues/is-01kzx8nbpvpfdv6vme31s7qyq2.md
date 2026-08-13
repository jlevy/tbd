---
type: is
id: is-01kzx8nbpvpfdv6vme31s7qyq2
title: Project allow-listed external links into web board and bead detail responses
kind: task
status: open
priority: 2
version: 4
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - web
  - integration
dependencies:
  - type: blocks
    target: is-01kzx8nc1vetjsc86by8085sg1
  - type: blocks
    target: is-01kzx8ncczb69sp1bgyk20pyt5
parent_id: is-01kzx8mkeyergsd0hmq8zj1zd7
created_at: 2026-08-13T09:53:40.570Z
updated_at: 2026-08-13T15:59:38.816Z
extensions:
  linear:
    id: 40f5fc06-fa0e-4aa4-a8cf-297cd9216a59
    linked_at: 2026-08-13T15:59:38.815Z
---
Add one pure projection based on integrations/core/link-store.ts readLink()/linkedProviders() and use it from cli/web/board.ts BoardRow, BeadBody, BoardState.buildBoardResponse(), and getBead(). Return only provider, stable id, human key, and validated http(s) URL; never expose arbitrary extensions or bridge state. Preserve additive response compatibility, snapshot consistency, MAX_BOARD_ROWS, lazy body loading, and local-observer behavior so link/unlink/sync writes appear through the existing graph-version/SSE path without network access. Cover malformed namespaces, missing URLs, dual-provider beads, live updates, and JSON serialization.
