---
type: is
id: is-01kg5jhe5v1zx94azhqn57bnzq
title: "Phase 6: Update documentation for unified sync"
kind: task
status: open
priority: 3
version: 14
spec_path: docs/project/specs/active/plan-2026-01-29-unified-sync-command.md
labels: []
dependencies: []
parent_id: is-01kg5jgqscrbp94t3hb1cegr39
created_at: 2026-01-29T19:09:04.058Z
updated_at: 2026-08-11T07:07:50.832Z
extensions:
  linear:
    id: 8303672a-5715-4cf5-a8fd-8d9bd682fa20
    key: TBD-47
    url: https://linear.app/finterm-ai/issue/TBD-47/phase-6-update-documentation-for-unified-sync
    linked_at: 2026-08-10T19:36:24.682Z
    comments:
      - id: e706e2af-763e-4255-a4f6-d94ebbc5ce16
        at: 2026-08-11T07:07:07.909Z
        author: josh
        body: |-
          **tbd sync conflict**

          Field `description` on `tbd-xlmp` diverged and one value was discarded.

          - Kept: `"sha256v2:9a5b86c38120f51955e2a157717099469c44f6e979b48d73ab7848fe6ac50125"`
          - Discarded: `"sha256v2:5706cd9a25c2110648bf3a589ac436545abf5a765bf66e353d621bbc6e9f9eee"`

          The discarded value is archived at `.tbd/data-sync/attic/conflicts/is-01kg5jhe5v1zx94azhqn57bnzq`.
          Resolve this comment once the divergence has been reconciled.
---
Update documentation:

* Update tbd-design.md sync section
* Update SKILL.md sync instructions
* Update any shortcuts referencing docs --refresh
* Update CLI help text
