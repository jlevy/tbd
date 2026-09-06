---
type: is
id: is-01m1w3g81f4j2dgmqexbvxb7rn
title: "Coordination phase 3: budgeted continuous Git publication and watching"
kind: epic
status: open
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies:
  - type: blocks
    target: is-01m1w3gfnt79bzspk72y328gac
parent_id: is-01m1w39s0rrg0dp4p90cb4gg67
created_at: 2026-09-06T19:35:39.310Z
updated_at: 2026-09-06T19:35:47.128Z
---
Add an opt-in foreground coordinator per Git common directory, batched issue-only publication, multiplexed remote-tip polling and local notifications, replayable consumer state, startup and periodic readiness, jitter/backoff, queue/status metrics, and Git-only cloud tests. Published GitHub limits are repository-wide guidance; no global publisher or exclusive claim is implied.
