---
type: is
id: is-01kra9b5fxdwfj1dzmwqawd81j
title: "Scheme-specific fetcher: github: (sparse git clone, atomic swap; port RepoCache from PR #87)"
kind: task
status: open
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-05-07-docs-config-redesign.md
labels: []
dependencies:
  - type: blocks
    target: is-01kra9b5vg4adws2hxtyn51e1r
  - type: blocks
    target: is-01kra9b6yq2v5z2490t4f7c9et
parent_id: is-01kra98tffpc00qar6ee3zk8tv
created_at: 2026-05-11T01:10:08.125Z
updated_at: 2026-05-11T01:11:15.271Z
---
Sparse git clone --depth 1 --branch <ref>, atomic swap on success. Port RepoCache from PR #87, completing the update path.

Spec: Phase 2 bullet 2b (line ~1645), Workflow W5. Reference: PR #87 (unmerged) https://github.com/jlevy/tbd/pull/87.
