---
type: is
id: is-01m1w3gfnt79bzspk72y328gac
title: "Coordination phase 5: opt-in cross-agent workers and incremental adoption"
kind: epic
status: open
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies:
  - type: blocks
    target: is-01m1w462tz4ybawyp4hsranf5s
parent_id: is-01m1w39s0rrg0dp4p90cb4gg67
created_at: 2026-09-06T19:35:47.128Z
updated_at: 2026-09-06T19:51:27.405Z
---
Provide the native-only provider-neutral worker loop using Phase 1 conditional claims, durable work acceptance distinct from delivery, bounded targeted context, explicit delegation/subscriptions, and thin Claude/Codex adapters with capability checks and existing permissions. Persist dispatch intents and reconcile uncertain launches before retrying; test lost session handles and checkpoint replay. Prove local and Git-only cloud coordination, restart/cancellation/stale-owner behavior. Close and ship this phase after native-only gates; separately owned tbd-gtwx requires both this phase and Phase 4 for mixed human adoption, and does not block this release.
