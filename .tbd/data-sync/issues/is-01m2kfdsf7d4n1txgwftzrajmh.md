---
type: is
id: is-01m2kfdsf7d4n1txgwftzrajmh
title: "Push-only mirror sends status without slot, so every --push moves not-ready Linear items Backlog to Todo and fights the reconciler (new with #290)"
kind: bug
status: open
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels: []
dependencies:
  - type: blocks
    target: is-01m2eseh97vth3cpm35m074faf
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-15T21:26:33.703Z
updated_at: 2026-09-15T21:27:01.601Z
---
New with PR #290. The reconciler (sync engine) now writes the canonical slot, so open work that is not ready goes to Backlog. The push-only mirror still builds its patch with `status` and no `slot` (packages/tbd/src/integrations/core/mirror.ts:264-266), and the Linear adapter falls back to `statusToLinear` when `patch.slot` is absent (integrations/linear/adapter.ts:1021-1027), which maps open work to Todo.

Failure scenario: `tbd integration sync --push` (or `tbd sync --push --integrations`) moves every linked not-ready item from Backlog to Todo. The next reconciling sync moves it back, so the board column flips whenever push-only and full syncs alternate. Above the bulk threshold (`UPDATE_CONFIRM_THRESHOLD = 40`, core/bulk-guard.ts:14) under the default `guarded` mode, the push-back is refused with a remedy naming `--yes`, which `tbd sync` does not have (tbd-ub5a).

Fix (small): compute the slot in the mirror planner, which already has the ready set (`readyIssueIds`, `readyAt`), and send it on the mirror patch as the engine does (sync-engine.ts ~:605-615). Red test: a blocked or future-deferred linked epic stays in Backlog across `--push`, full sync, `--push`.

Relationship: tbd-mjb7 (interim `--push` wording) and tbd-6md1 (one planner, Phase 1B) eventually remove the mirror; this fix is needed before Release 1 because #290 made the two paths disagree. Code path verified by reading main @ 1238038e; run sequence inferred. Release 1 gate for Linear users.
