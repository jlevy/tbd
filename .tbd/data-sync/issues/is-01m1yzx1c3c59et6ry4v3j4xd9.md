---
type: is
id: is-01m1yzx1c3c59et6ry4v3j4xd9
title: tbd sync --yes
kind: feature
status: open
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-1
dependencies: []
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-07T22:30:27.452Z
updated_at: 2026-09-07T22:31:40.796Z
---
GH #276. tbd sync has no --yes (sync.ts:1548-1565); under the default on_tbd_sync: guarded posture (provider-settings.ts:181-214) the fold runs with assumeYes false, so an oversized run fails with advice for a different command. Add --yes: assumeYes true for the tracker fold regardless of posture except off; under report mode --yes is an error naming the config key. e2e in the shape of tests/integration-nesting-config.e2e.test.ts: 41 updates blocked without --yes, proceeds with it. No test exercises the 'large change' message through the CLI today.
