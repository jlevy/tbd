---
type: is
id: is-01kg5jhcrf73dwx67jm7xhsb5a
title: "Phase 1: Extract shared syncDocsWithDefaults() function"
kind: task
status: open
priority: 2
version: 17
spec_path: docs/project/specs/active/plan-2026-01-29-unified-sync-command.md
labels: []
dependencies:
  - type: blocks
    target: is-01kg5jhd1bprqhysw96b5genm0
  - type: blocks
    target: is-01kg5jhd9dbyg3k2c5j8seahk5
  - type: blocks
    target: is-01kg5jhdtwzxw7ce1xvnnc5tn3
parent_id: is-01kg5jgqscrbp94t3hb1cegr39
created_at: 2026-01-29T19:09:02.601Z
updated_at: 2026-08-11T07:07:50.030Z
extensions:
  linear:
    id: b3fc13b3-ecc2-468c-b5fb-2df336e72f44
    key: TBD-52
    url: https://linear.app/finterm-ai/issue/TBD-52/phase-1-extract-shared-syncdocswithdefaults-function
    linked_at: 2026-08-10T19:36:20.429Z
    comments:
      - id: 87966bbd-fb5f-41c1-8d1f-d0c794c43a3f
        at: 2026-08-11T07:07:04.619Z
        author: josh
        body: |-
          **tbd sync conflict**

          Field `description` on `tbd-offi` diverged and one value was discarded.

          - Kept: `"sha256v2:d475ddca61aa770f1c38b0d8bee59bff7252d5e2c67603baff34b249bfe82f66"`
          - Discarded: `"sha256v2:9595207722182227e2429ce45b4bc2dc0f959997b05d9051f6153dad62721610"`

          The discarded value is archived at `.tbd/data-sync/attic/conflicts/is-01kg5jhcrf73dwx67jm7xhsb5a`.
          Resolve this comment once the divergence has been reconciled.
---
Create syncDocsWithDefaults() in doc-sync.ts with:

* Merge defaults from bundled docs
* pruneStaleInternals() helper to remove missing internal sources
* Config comparison and conditional write
* Unit tests for new functions
