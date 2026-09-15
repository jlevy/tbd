---
type: is
id: is-01m2exket07e1spjj21f2bz23z
title: "f08 contract T4: two-clone tbd-sync merge with a 0.8.1 clone reading candidate-written attic, records, intents"
kind: task
status: closed
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-0
dependencies:
  - type: blocks
    target: is-01m2egwz6r0qgbtvzh2nkevjdb
  - type: blocks
    target: is-01m2esef50qbe11ancst0cmnj1
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-14T02:58:07.295Z
updated_at: 2026-09-15T21:26:59.635Z
closed_at: 2026-09-15T21:26:59.633Z
close_reason: |
  Done on main via PR #288 (merge 49615fa9): ded79a33 and a0f4d629 add validateCrossVersionCoexistence to scripts/validate-upgrade-package.mjs (the oldest published f08 client merges and reads candidate-written attic entries and preserves bridge records and journaled intents across a two-clone tbd-sync merge). The plan's Phase 0 row is already marked done. Gap recorded on tbd-yqq7: T4 does not exercise an old client merging a two-sided edit under merge=binary. Verified in the 2026-09-15 release-readiness review of 1238038e.
resolution: null
duplicate_of: null
---
f08 compatibility contract, test T4: two-clone tbd-sync merge across versions. The upgrade proof never runs a two-clone merge. Create a bare remote with one clone on packed 0.8.1 and one on the candidate; the candidate writes attic entries from `tbd sync` conflicts (tbd-ajq2), bridge records, and journaled intents; the 0.8.1 clone pulls, merges a concurrent edit, and pushes. Assert 0.8.1 lists, shows, and restores the attic entries, its intent reader does not throw (an unrecognized intent makes listIntentFiles throw for the whole provider, integrations/core/intents.ts:152-157), and the candidate reads the result back unchanged.
