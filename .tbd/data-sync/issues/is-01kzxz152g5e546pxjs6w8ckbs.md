---
type: is
id: is-01kzxz152g5e546pxjs6w8ckbs
title: Add comprehensive API-driven live Linear round-trip QA
kind: task
status: open
priority: 1
version: 1
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - linear
  - integration
  - qa
dependencies: []
parent_id: is-01kzxxj27abvbje3nesecgsk3z
created_at: 2026-08-13T16:24:35.663Z
updated_at: 2026-08-13T16:24:35.663Z
---
Make direct Linear API mutation and verification the primary live QA gate, with the Linear UI used only as a parity sanity check. Cover tbd-to-Linear and Linear-to-tbd fields, comments, hierarchy/sub-issues, mode boundaries, exact-once replay, no-op convergence, error reporting, and cleanup/restoration in a checked-in reproducible playbook/harness.
