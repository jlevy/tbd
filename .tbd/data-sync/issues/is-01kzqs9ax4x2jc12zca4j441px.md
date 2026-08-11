---
type: is
id: is-01kzqs9ax4x2jc12zca4j441px
title: sync should detect multiple beads linked to one external item
kind: bug
status: open
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies: []
parent_id: is-01kzn2w85qxpbp8cqtn7mkbvkg
created_at: 2026-08-11T06:48:45.731Z
updated_at: 2026-08-11T06:51:08.880Z
extensions:
  linear:
    id: d81f3bf1-4d78-41a5-81ae-f5254dcd6d89
    linked_at: 2026-08-11T06:51:08.880Z
    key: TBD-132
    url: https://linear.app/finterm-ai/issue/TBD-132/sync-should-detect-multiple-beads-linked-to-one-external-item
---
The one-source guard runs at link/import time only; pre-existing data can still hold N beads sharing one external id (found live: four Phase 1 beads all carried the epic's uuid after the legacy-link migration, so four writers pushed one item). The engine's linked-pair loop and doctor should detect duplicate external ids across the linked set, report all holders, and refuse to push any of them until resolved. Repaired by hand with unlink + link --take local this time.
