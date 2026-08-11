---
type: is
id: is-01kg5jhd9dbyg3k2c5j8seahk5
title: "Phase 3: Update auto-sync in DocCache to merge defaults"
kind: task
status: open
priority: 2
version: 15
spec_path: docs/project/specs/active/plan-2026-01-29-unified-sync-command.md
labels: []
dependencies:
  - type: blocks
    target: is-01kg5jhee3nrrtkqa80h52p1d8
parent_id: is-01kg5jgqscrbp94t3hb1cegr39
created_at: 2026-01-29T19:09:03.148Z
updated_at: 2026-08-11T07:07:50.373Z
extensions:
  linear:
    id: 6fca87f0-1602-46fa-9d1b-b4072ed53152
    key: TBD-50
    url: https://linear.app/finterm-ai/issue/TBD-50/phase-3-update-auto-sync-in-doccache-to-merge-defaults
    linked_at: 2026-08-10T19:36:22.222Z
    comments:
      - id: 7bee7975-4496-4c64-9055-c7bad2b21127
        at: 2026-08-11T07:07:06.388Z
        author: josh
        body: |-
          **tbd sync conflict**

          Field `description` on `tbd-2d3s` diverged and one value was discarded.

          - Kept: `"sha256v2:1c1e3c2b61f39836c25d4a3915e9f20507f72d754e1f6dcef28809675872ffe4"`
          - Discarded: `"sha256v2:16cdbc39b0fd2bd82fd336818c8f1777e6393bc62d3bfa4a8e81ef0c5a0cf6cb"`

          The discarded value is archived at `.tbd/data-sync/attic/conflicts/is-01kg5jhd9dbyg3k2c5j8seahk5`.
          Resolve this comment once the divergence has been reconciled.
---
Update doc-cache.ts checkAutoSync() to:

* Use syncDocsWithDefaults() instead of direct DocSync
* Ensure auto-sync merges defaults (picks up new bundled docs)
* Unit tests for auto-sync behavior
