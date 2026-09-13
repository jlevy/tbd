---
type: is
id: is-01m2egx888wh2r62pt8ce4d3wz
title: Retire planMirror/applyMirror and push-only printers; SyncRunReport for --push --json; docs
kind: task
status: open
priority: 1
version: 1
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-1
dependencies: []
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-13T23:16:16.774Z
updated_at: 2026-09-13T23:16:16.774Z
---
After the one-planner, selector, and port beads: delete planMirror/applyMirror, PushHandler, runEnabledIntegrationPushes, runIntegrationPushInPosition, reportIntegrationPush, and the MirrorPlan/MirrorReport types. `--push --json` emits SyncRunReport (breaking change for consumers; release note). Rewrite mirror tests against the engine one behavior at a time rather than deleting them. Update setup-linear.md Cases A and B (and its :208 overwrite warning), the integration sections of tbd-design.md and tbd-docs.md (after PR #283 lands), and plan-2026-08-10-external-tracker-integrations.md :399-408. Close tbd-dqiq with this bead.
