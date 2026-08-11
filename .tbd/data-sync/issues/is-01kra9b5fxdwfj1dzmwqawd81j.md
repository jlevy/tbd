---
type: is
id: is-01kra9b5fxdwfj1dzmwqawd81j
title: "Scheme-specific fetcher: github: (sparse git clone, atomic swap; port RepoCache from PR #87)"
kind: task
status: open
priority: 2
version: 9
spec_path: docs/project/specs/active/plan-2026-05-07-docs-config-redesign.md
labels: []
dependencies:
  - type: blocks
    target: is-01kra9b5vg4adws2hxtyn51e1r
  - type: blocks
    target: is-01kra9b6yq2v5z2490t4f7c9et
parent_id: is-01kra98tffpc00qar6ee3zk8tv
created_at: 2026-05-11T01:10:08.125Z
updated_at: 2026-08-11T07:07:19.858Z
extensions:
  linear:
    id: 873abbcc-409e-47d1-82f7-e30d638c5437
    linked_at: 2026-08-11T06:50:20.391Z
    key: TBD-100
    url: https://linear.app/finterm-ai/issue/TBD-100/scheme-specific-fetcher-github-sparse-git-clone-atomic-swap-port
    comments:
      - id: f88e484d-51bb-40c3-a3c1-abfd2dcc9952
        at: 2026-08-11T07:07:19.522Z
        author: josh
        body: |-
          **tbd sync conflict**

          Field `description` on `tbd-wnfb` diverged and one value was discarded.

          - Kept: `"sha256v2:37d5a3adb5a156d4c4c1202fcc4a6fd635eda34b24d77c7d16344aeae8dc4526"`
          - Discarded: `"sha256v2:6860ed2f119609294a2d91cabd84dcda3f1effce717487d6aafefa795fcb2472"`

          The discarded value is archived at `.tbd/data-sync/attic/conflicts/is-01kra9b5fxdwfj1dzmwqawd81j`.
          Resolve this comment once the divergence has been reconciled.
---
Sparse git clone --depth 1 --branch <ref>, atomic swap on success. Port RepoCache from PR #87, completing the update path.

Spec: Phase 2 bullet 2b (line ~1645), Workflow W5. Reference: PR #87 (unmerged) https://github.com/jlevy/tbd/pull/87.
