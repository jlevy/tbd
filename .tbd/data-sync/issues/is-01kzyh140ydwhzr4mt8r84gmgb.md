---
type: is
id: is-01kzyh140ydwhzr4mt8r84gmgb
title: "Consolidate --push onto the sync engine: two engines behind one flag vocabulary"
kind: task
status: open
priority: 1
version: 8
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies: []
parent_id: is-01kzn2w85qxpbp8cqtn7mkbvkg
created_at: 2026-08-13T21:39:08.958Z
updated_at: 2026-09-13T23:18:33.902Z
extensions:
  linear:
    id: 6258fc73-21ec-44cd-89c0-89ec690ae6b2
    linked_at: 2026-08-16T00:13:19.729Z
---
'tbd integration sync --push' and 'tbd sync --push' route to runEnabledIntegrationPushes -> planMirror/applyMirror (the Phase 1 one-way mirror). Bare sync and --pull route to runSync. runSync has no outbound-only mode (direction?: 'both' | 'inbound', sync-engine.ts:143).

Taking the --push path means: no three-way reconcile (a Linear-side edit is overwritten with no conflict comment and no archived artifact), no bridge base written, no intent journal (no crash replay), no comment push, and parentId: null can un-parent a provider issue.

Docs present --push as simply 'outbound only' -- the same operation, half the directions -- and the manual recommended it as the first step for new users.

Fix (pick one):
(a) Add direction: 'outbound' to runSync, route --push through it, retire planMirror/applyMirror.
(b) Keep both engines, document the divergence honestly, stop recommending --push as the onboarding default.

The doc half of (b) landed in the review branch. (a) is the real fix.

Revision 2026-09-13 (stability sprint plan review, plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md): Scheduled as Phase 1B of the stability sprint plan: tbd-6md1 (one planner, direction as a filter), tbd-8x2a (selectors in every mode), tbd-9tj0 (port mirror-only behavior), tbd-1hdt (--take local|remote), tbd-qeug (retire the mirror; closes this bead). The plan evaluates push-only use cases; only restoring Linear after a bad Linear-side edit needs an overwrite, and that becomes --take local.

## Notes

Deferred from PR #212: consolidating --push onto runSync is the preferred fix, but it replaces a complete engine and changes conflict, journal, comment, and base semantics beyond the managed-marker patch. Keep as the dedicated P1 follow-up.
