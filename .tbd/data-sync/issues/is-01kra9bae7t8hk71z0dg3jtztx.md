---
type: is
id: is-01kra9bae7t8hk71z0dg3jtztx
title: "Phase 2 tests: e2e eject→edit→diff→unfork, bundle-add preview golden, status golden, lockfile round-trip"
kind: task
status: open
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-05-07-docs-config-redesign.md
labels: []
dependencies: []
parent_id: is-01kra98tffpc00qar6ee3zk8tv
created_at: 2026-05-11T01:10:13.190Z
updated_at: 2026-08-11T06:50:40.323Z
extensions:
  linear:
    id: 039bbcc8-35e4-4960-956f-a9d568610588
    linked_at: 2026-08-11T06:50:40.323Z
    key: TBD-112
    url: https://linear.app/finterm-ai/issue/TBD-112/phase-2-tests-e2e-ejecteditdiffunfork-bundle-add-preview-golden-status
---
- End-to-end eject → edit → diff → unfork against a fixture git source.
- Bundle-add preview golden tests.
- Status output golden tests.
- Lockfile round-trip tests (G9 reproducibility).
- Integration: RepoCache against a local bare-repo fixture; full sync cycle with mixed source types.

Spec: Phase 2 bullet 13 (line ~1676), ## Testing Strategy (line ~1704).
