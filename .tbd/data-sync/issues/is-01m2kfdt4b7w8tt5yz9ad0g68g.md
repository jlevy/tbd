---
type: is
id: is-01m2kfdt4b7w8tt5yz9ad0g68g
title: Linear resume keeps the tbd:paused carrier label, so the next sync pulls the hold back onto the bead
kind: bug
status: open
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels: []
dependencies: []
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-15T21:26:34.378Z
updated_at: 2026-09-16T08:28:35.929Z
extensions:
  linear:
    id: 99c9d426-e7b6-49c5-a784-a633e354f918
    linked_at: 2026-09-16T08:28:35.929Z
---
Pre-existing (also in 0.8.1), untracked. Reported by the 2026-09-15 release-readiness review of main @ 1238038e; inferred from code with high confidence, not yet reproduced.

On a state write the Linear adapter removes the `tbd:blocked` and `tbd:deferred` carrier labels but not `tbd:paused` (integrations/linear/adapter.ts ~:524).

Scenario: default `labels.mirror: none` (provider-settings.ts ~:103) on a stock team with no Paused state. Pausing writes In Progress plus the `tbd:paused` carrier label. Resuming writes In Progress again but leaves the label. The next sync reads the label as `paused` (mapping.ts ~:362) and pulls the hold back onto the bead, so a resume never sticks.

The existing test (integrations-sync-engine.test.ts ~:874-906) stops one run too early to see it. Red test: pause, sync, resume, sync, sync; assert hold stays none and the label is gone.
