---
type: is
id: is-01kra9b6yq2v5z2490t4f7c9et
title: tbd sync --docs and tbd source update [<bundle>] (scheme-specific fetch + lockfile + map rebuild)
kind: task
status: open
priority: 2
version: 7
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
updated_at: 2026-08-11T06:57:36.974Z
extensions:
  linear:
    id: e0c34d16-2c91-4929-8df8-dc16aa18001c
    linked_at: 2026-08-11T06:50:27.681Z
    key: TBD-104
    url: https://linear.app/finterm-ai/issue/TBD-104/tbd-sync-docs-and-tbd-source-update-bundle-scheme-specific-fetch
---
Keep sync and update sharply separated:

* sync must reproduce the lockfile
* source update [source|bundle] advances revisions and rewrites lock entries

Status must distinguish: missing cache, cache hash mismatch, locked and present, upstream has newer revision, local override diverges from current upstream, explicit override is orphaned.

Spec: Phase 2 bullet 5 (line ~1655), Workflow W5.
