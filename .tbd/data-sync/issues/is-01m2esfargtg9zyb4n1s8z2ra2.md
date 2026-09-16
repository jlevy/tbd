---
type: is
id: is-01m2esfargtg9zyb4n1s8z2ra2
title: Push-only projection sends delegateId for every selected linked bead on every run, including closed beads
kind: bug
status: closed
priority: 2
version: 6
spec_path: docs/project/specs/active/plan-2026-08-18-actor-axis-and-identity.md
labels: []
dependencies:
  - type: blocks
    target: is-01m2eseh97vth3cpm35m074faf
parent_id: is-01m0c4z87m3kd0cyw2qkd5k6z4
created_at: 2026-09-14T01:45:57.776Z
updated_at: 2026-09-16T06:38:27.451Z
closed_at: 2026-09-16T06:38:27.451Z
close_reason: "Implemented and merged to main with green PR CI: tbd-yqq7 in #292 (705f70c0), tbd-evn3 in #293 (05f7eb66), and tbd-80vz in #294 (7120d16f). Verified against origin/main during the 2026-09-15 release-readiness audit."
resolution: null
duplicate_of: null
---
Behavior change in PR #283 (tbd-w3tv): with agent_map honored, the push-only projection (`tbd integration sync --push`, `tbd sync --push --integrations`) sends `delegateId` for every selected linked bead whose delegate maps (mirror.ts:292-296), on every run, because the mirror does not diff against Linear; closed beads keep `delegate` (close does not clear it), so they are included. linear/adapter.ts:1008 notes that Linear turns a delegate write into an Agent Session. Not verified: whether Linear starts a new session when the same delegateId is written again.

The reconcile path (bare `integration sync`, the `tbd sync` fold) never sends or reads delegate (SYNCED_FIELDS has no delegate, reconcile.ts:41; the create patch at sync-engine.ts:1530 omits it), and nothing writes an inbound delegate onto beads.

Interim: send delegate only when it differs from the item's current delegate and never for closed beads; verify repeated identical writes against live Linear (QA playbook). Permanent: Phase 1B tbd-9tj0 ports delegate into the engine with change detection. Release note either way.

## Notes

2026-09-15: PR #294 (https://github.com/jlevy/tbd/pull/294), branch fix/mirror-delegate-change-detection, not merged. Implements the interim fix described above: skip closed beads, and write only a changed delegate.

Fix:
- `planMirror` omits the delegate for closed beads and reports no skip for them.
- `LinearAdapter.applyChanges` reads the item's current delegate, reusing its existing labels read, and drops `delegateId` when the item already has the same app user. The comparison is by app-user id.

Tests:
- integrations-mirror.test.ts 'publishes a delegate for open work but never for a closed bead'.
- integrations-mirror.test.ts 'sends a delegate once, not on every push': 3 delegate writes across 3 pushes before, 1 after.
- linear-adapter.test.ts 'does not rewrite the delegate an item already has' and a control for a differing or absent delegate.

tbd-docs.md no longer claims a mapped delegate is "read back as a bead delegate".

Still unverified: whether live Linear starts a new Agent Session on an identical delegateId write. There is no delegate scenario in the QA playbook or the live runner, and it needs an installed agent. The permanent fix remains tbd-9tj0.

Leave open until merge.

CI: all 7 checks green (Test ubuntu Node 22.12.0/24, macOS, Windows; Coverage & Lint; Benchmark; DeepSource).

2026-09-15: live Linear QA has no delegate or agent_map scenario. Neither `tests/qa/linear-integration.qa.md` nor `scripts/validate-linear-integration-live.ts` (or the `provider-live-qa-contract.ts` checklist) exercises publishing a delegate, so whether an identical `delegateId` write, or re-delegation after a removal, starts a new Agent Session is unverified and cannot be checked in the current QA pass. A scenario would need a workspace with an installed agent (app user). Review of #294 also established that `--push` restores a delegate removed in Linear while the bead names the agent; that is now documented in tbd-docs.md, and the design question is on tbd-9tj0.
