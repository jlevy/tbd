---
type: is
id: is-01kra9b6yq2v5z2490t4f7c9et
title: tbd sync --docs and tbd source update [<bundle>] (scheme-specific fetch + lockfile + map rebuild)
kind: task
status: open
priority: 2
version: 12
spec_path: docs/project/specs/active/plan-2026-05-07-docs-config-redesign.md
labels: []
dependencies:
  - type: blocks
    target: is-01kra9b7q4zewzz4vgdw17vvav
  - type: blocks
    target: is-01kra9b7a1qhwfgg7shvnka1hp
  - type: blocks
    target: is-01kra9ba2a6fbrkb1qvxeactgn
  - type: blocks
    target: is-01kra9bae7t8hk71z0dg3jtztx
parent_id: is-01kra98tffpc00qar6ee3zk8tv
created_at: 2026-05-11T01:10:09.623Z
updated_at: 2026-08-11T07:07:53.261Z
extensions:
  linear:
    id: e0c34d16-2c91-4929-8df8-dc16aa18001c
    linked_at: 2026-08-11T06:50:27.681Z
    key: TBD-104
    url: https://linear.app/finterm-ai/issue/TBD-104/tbd-sync-docs-and-tbd-source-update-bundle-scheme-specific-fetch
    comments:
      - id: 75abf821-e430-446e-9f0e-279c09d2c8f2
        at: 2026-08-11T07:07:21.263Z
        author: josh
        body: |-
          **tbd sync conflict**

          Field `description` on `tbd-q5ii` diverged and one value was discarded.

          - Kept: `"sha256v2:5a48030a82aac47a6d53157a10d7f5944a9e803caaa1337c85138b9ad8f786f1"`
          - Discarded: `"sha256v2:3db470472c1901220de9c553364e3f64e5cc62cb08ec657e9c3fe9c306bfab33"`

          The discarded value is archived at `.tbd/data-sync/attic/conflicts/is-01kra9b6yq2v5z2490t4f7c9et`.
          Resolve this comment once the divergence has been reconciled.
---
Keep sync and update sharply separated:

* sync must reproduce the lockfile
* source update [source|bundle] advances revisions and rewrites lock entries

Status must distinguish: missing cache, cache hash mismatch, locked and present, upstream has newer revision, local override diverges from current upstream, explicit override is orphaned.

Spec: Phase 2 bullet 5 (line ~1655), Workflow W5.
