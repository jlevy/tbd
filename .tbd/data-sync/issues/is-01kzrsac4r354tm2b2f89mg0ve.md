---
type: is
id: is-01kzrsac4r354tm2b2f89mg0ve
title: "Phase 6.1: run full quality matrix plus 5k performance and payload gates"
kind: task
status: open
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - validation
  - performance
  - web
dependencies:
  - type: blocks
    target: is-01kzrsajhday2nyvfnbk2c097t
parent_id: is-01kzrs779s8d2t4qmvpx310p22
created_at: 2026-08-11T16:08:34.199Z
updated_at: 2026-08-11T16:08:40.748Z
---
Run format:check, lint:check, typecheck, build, publint, full Vitest and tryscript suites, package-age, and audit triage; add/assert board generation under the documented budget on a 5,000-issue fixture, payload exclusion/bounds, and unchanged non-web CLI startup/behavior. Diagnose every failure rather than labeling it unrelated.
