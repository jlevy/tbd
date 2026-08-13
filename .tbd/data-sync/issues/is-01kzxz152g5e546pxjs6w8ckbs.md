---
type: is
id: is-01kzxz152g5e546pxjs6w8ckbs
title: Add comprehensive API-driven live Linear round-trip QA
kind: task
status: closed
priority: 1
version: 5
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - linear
  - integration
  - qa
dependencies: []
parent_id: is-01kzxxj27abvbje3nesecgsk3z
child_order_hints:
  - is-01kzy1taxvxgk86npza1zbkb06
created_at: 2026-08-13T16:24:35.663Z
updated_at: 2026-08-13T17:56:04.363Z
closed_at: 2026-08-13T17:56:04.363Z
close_reason: "Compatibility review is complete: implementation gaps are fixed, all findings are mapped in the authoritative matrix, product/design/development/skill docs agree, deterministic CI is green (132 files, 1,956 tests), and the API-driven Linear gate passed all 11 scenarios with verified cleanup."
---
Make direct Linear API mutation and verification the primary live QA gate, with the Linear UI used only as a parity sanity check. Cover tbd-to-Linear and Linear-to-tbd fields, comments, hierarchy/sub-issues, mode boundaries, exact-once replay, no-op convergence, error reporting, and cleanup/restoration in a checked-in reproducible playbook/harness.

## Notes

Added packages/tbd/scripts/validate-linear-integration-live.ts and the qa:linear-live package command. The provider API is both driver and oracle while the built candidate runs in a disposable git repository with its credential removed from child environments. Stable contract now has 11 scenarios: setup, explicit import, deferred claim replay, fields/comments/assignee both ways, provider hierarchy, automatic project scope, conflict recovery, exact-once settle, orphan detection, and cleanup. Documented command passed live against team TBD/project tbd on 2026-08-13 and archived all fixtures.
