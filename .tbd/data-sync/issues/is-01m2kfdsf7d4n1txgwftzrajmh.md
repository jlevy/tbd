---
type: is
id: is-01m2kfdsf7d4n1txgwftzrajmh
title: "Push-only mirror sends status without slot, so every --push moves not-ready Linear items Backlog to Todo and fights the reconciler (new with #290)"
kind: bug
status: in_progress
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels: []
dependencies:
  - type: blocks
    target: is-01m2eseh97vth3cpm35m074faf
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-15T21:26:33.703Z
updated_at: 2026-09-15T22:19:29.971Z
---
New with PR #290. The reconciler (sync engine) now writes the canonical slot, so open work that is not ready goes to Backlog. The push-only mirror still builds its patch with `status` and no `slot` (packages/tbd/src/integrations/core/mirror.ts:264-266), and the Linear adapter falls back to `statusToLinear` when `patch.slot` is absent (integrations/linear/adapter.ts:1021-1027), which maps open work to Todo.

Failure scenario: `tbd integration sync --push` (or `tbd sync --push --integrations`) moves every linked not-ready item from Backlog to Todo. The next reconciling sync moves it back, so the board column flips whenever push-only and full syncs alternate. Above the bulk threshold (`UPDATE_CONFIRM_THRESHOLD = 40`, core/bulk-guard.ts:14) under the default `guarded` mode, the push-back is refused with a remedy naming `--yes`, which `tbd sync` does not have (tbd-ub5a).

Fix (small): compute the slot in the mirror planner, which already has the ready set (`readyIssueIds`, `readyAt`), and send it on the mirror patch as the engine does (sync-engine.ts ~:605-615). Red test: a blocked or future-deferred linked epic stays in Backlog across `--push`, full sync, `--push`.

Relationship: tbd-mjb7 (interim `--push` wording) and tbd-6md1 (one planner, Phase 1B) eventually remove the mirror; this fix is needed before Release 1 because #290 made the two paths disagree. Code path verified by reading main @ 1238038e; run sequence inferred. Release 1 gate for Linear users.

## Notes

2026-09-15: PR #293 (https://github.com/jlevy/tbd/pull/293), branch fix/mirror-push-slot, not merged.

Root cause confirmed against the Linear mock. `planMirror` sent status, resolution, and hold with no slot, and the adapter's `statusToLinear` fallback put open, not-ready work in Todo. The run sequence differs from the inference above: after `--push` moved a blocked epic and a future-deferred epic to Todo, the next full sync did NOT move them back. In a separate run on unfixed code (full, --push, then 4 full syncs), the item stayed in Todo for 2 full syncs, and the 3rd full sync moved it to Backlog. That is relevant to T3 (tbd-s4kb) for 0.8.1 `--push` clients.

Fix: `outboundPosition(bead, ready)` in slots.ts, shared by the engine's create path (`positionOf`) and `planMirror`.

Side effect, noted in the PR: a legacy `status: blocked` bead now lands in the team's named Blocked state when one exists, as the reconciler already does.

Tests:
- integration-slot-convergence.test.ts 'keeps not-ready linked epics in Backlog when push-only and full syncs alternate'. Red before the fix; now Backlog throughout, and the middle full sync makes 0 mutations.
- integrations-mirror.test.ts 'sends the slot the reconciler computes...'.

Leave open until merge.

CI: all 7 checks green (Test ubuntu Node 22.12.0/24, macOS, Windows; Coverage & Lint; Benchmark; DeepSource).
