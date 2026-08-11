---
type: is
id: is-01kg5jhee3nrrtkqa80h52p1d8
title: "Phase 7: Testing for unified sync"
kind: task
status: open
priority: 3
version: 14
spec_path: docs/project/specs/active/plan-2026-01-29-unified-sync-command.md
labels: []
dependencies: []
parent_id: is-01kg5jgqscrbp94t3hb1cegr39
created_at: 2026-01-29T19:09:04.323Z
updated_at: 2026-08-11T07:07:50.975Z
extensions:
  linear:
    id: 1e220fa3-d020-48a5-9131-86eabc1c9d98
    key: TBD-46
    url: https://linear.app/finterm-ai/issue/TBD-46/phase-7-testing-for-unified-sync
    linked_at: 2026-08-10T19:36:26.324Z
    comments:
      - id: c22a3cf3-9deb-4282-8bf8-d5e0ca2c6607
        at: 2026-08-11T07:07:08.663Z
        author: josh
        body: |-
          **tbd sync conflict**

          Field `description` on `tbd-2dmg` diverged and one value was discarded.

          - Kept: `"sha256v2:60e4dfa829796410a26cf88296fc94ea32ccec03fe1366f23164754b5991a13f"`
          - Discarded: `"sha256v2:250c34438b9ac70cd209efaa986e6e355e73f1c42d18959b6b4313d541da9240"`

          The discarded value is archived at `.tbd/data-sync/attic/conflicts/is-01kg5jhee3nrrtkqa80h52p1d8`.
          Resolve this comment once the divergence has been reconciled.
---
Add tests:

* Unit tests for syncDocsWithDefaults()
* Unit tests for auto-prune behavior
* Integration test: tbd sync syncs both
* Integration test: tbd sync --issues only syncs issues
* Integration test: tbd sync --docs only syncs docs
* Integration test: new bundled docs appear after upgrade simulation
* Integration test: stale internals are pruned
* Verify tbd docs --refresh returns command not found
