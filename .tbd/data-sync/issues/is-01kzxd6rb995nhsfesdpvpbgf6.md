---
type: is
id: is-01kzxd6rb995nhsfesdpvpbgf6
title: Keep comment-union TypeScript source text-only
kind: chore
status: closed
priority: 3
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - maintainability
dependencies: []
parent_id: is-01kzx848mdfzapsc2ddm6hm0zt
created_at: 2026-08-13T11:13:04.872Z
updated_at: 2026-08-13T11:49:49.511Z
closed_at: 2026-08-13T11:49:49.511Z
close_reason: Implemented and reviewed. Focused real-binary/engine regressions and the complete local RC gate set pass; live Linear lifecycle, explicit inbound, conflict, orphan, and two-clone soak evidence is recorded in the QA playbook.
---
packages/tbd/src/lib/comment-union.ts contains a literal NUL byte as the sort-key separator. Runtime behavior is valid, but Git treats the TypeScript source as binary and hides meaningful review diffs. Express the separator as the equivalent \u0000 escape so the source remains text and prove comment merge tests remain green.
