---
type: is
id: is-01m2exkc964z2zqhhpmebr51s1
title: "f08 contract T1: 0.8.1 baseline and old-client config round trip for nested keys"
kind: task
status: open
priority: 1
version: 1
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-0
dependencies: []
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-14T02:58:04.709Z
updated_at: 2026-09-14T02:58:04.709Z
---
f08 compatibility contract, test T1. packages/tbd/scripts/validate-upgrade-package.mjs checks only that the CANDIDATE preserves unknown keys (:217-228, :358-365); the 0.7.0 client only runs `status` afterward (:444-447), probes exist only at the top level and under an unknown integrations provider, and 0.8.1 is not a baseline (:58).

Add 0.8.1 as a second same-format baseline. After the candidate writes config, run the OLD client's `tbd config set` and `tbd setup --auto` and assert that keys the sprint adds survive at their nesting level: `policy.outbound.deep` (passthrough level), `specs.dir` (top level), an `identity` probe; and that a `policy.<sibling>` key is dropped (negative control: PolicyDefinitionSchema is deliberately not passthrough, lib/schemas.ts ~761-795). Any sprint PR adding a config key extends this probe list.
