---
type: is
id: is-01kzzbq8avtcm913zn10t4t71a
title: "PR #216 review R4: canonical config compatibility policy is stale"
kind: bug
status: closed
priority: 2
version: 3
labels:
  - review
dependencies: []
parent_id: is-01kzzbpmdv336m2wnrbqpx473c
created_at: 2026-08-14T05:25:37.242Z
updated_at: 2026-08-14T06:12:49.033Z
closed_at: 2026-08-14T06:12:49.033Z
close_reason: Fixed in bbad205b; complete local release matrix and PR CI are green
---
Formal review 4934238677 on PR #216, packages/tbd/docs/tbd-design.md:1680. The design doc still says ConfigSchema strips unknown fields and every addition requires a format bump, contradicting f07 passthrough. Correct the policy and mark the older integration-spike constraint historical/superseded.
