---
type: is
id: is-01m2esfargtg9zyb4n1s8z2ra2
title: Push-only projection sends delegateId for every selected linked bead on every run, including closed beads
kind: bug
status: open
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-18-actor-axis-and-identity.md
labels: []
dependencies:
  - type: blocks
    target: is-01m2eseh97vth3cpm35m074faf
parent_id: is-01m0c4z87m3kd0cyw2qkd5k6z4
created_at: 2026-09-14T01:45:57.776Z
updated_at: 2026-09-14T01:45:58.376Z
---
Behavior change in PR #283 (tbd-w3tv): with agent_map honored, the push-only projection (`tbd integration sync --push`, `tbd sync --push --integrations`) sends `delegateId` for every selected linked bead whose delegate maps (mirror.ts:292-296), on every run, because the mirror does not diff against Linear; closed beads keep `delegate` (close does not clear it), so they are included. linear/adapter.ts:1008 notes that Linear turns a delegate write into an Agent Session. Not verified: whether Linear starts a new session when the same delegateId is written again.

The reconcile path (bare `integration sync`, the `tbd sync` fold) never sends or reads delegate (SYNCED_FIELDS has no delegate, reconcile.ts:41; the create patch at sync-engine.ts:1530 omits it), and nothing writes an inbound delegate onto beads.

Interim: send delegate only when it differs from the item's current delegate and never for closed beads; verify repeated identical writes against live Linear (QA playbook). Permanent: Phase 1B tbd-9tj0 ports delegate into the engine with change detection. Release note either way.
