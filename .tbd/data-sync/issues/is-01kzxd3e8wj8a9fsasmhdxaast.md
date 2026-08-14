---
type: is
id: is-01kzxd3e8wj8a9fsasmhdxaast
title: Restore optional attic fields without dynamic deletion
kind: bug
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - attic
  - quality-gate
dependencies: []
parent_id: is-01kzx848mdfzapsc2ddm6hm0zt
created_at: 2026-08-13T11:11:16.251Z
updated_at: 2026-08-13T11:49:49.504Z
closed_at: 2026-08-13T11:49:49.504Z
close_reason: Implemented and reviewed. Focused real-binary/engine regressions and the complete local RC gate set pass; live Linear lifecycle, explicit inbound, conflict, orphan, and two-clone soak evidence is recorded in the QA playbook.
---
packages/tbd/src/cli/commands/attic.ts AtticRestoreHandler used a dynamic delete for optional text fields, violating the project safety lint contract. Restore null description/notes by immutable omission while retaining the reverse archive and exact value behavior; prove lint and attic tests pass.
