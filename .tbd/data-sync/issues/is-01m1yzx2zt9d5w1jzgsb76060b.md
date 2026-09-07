---
type: is
id: is-01m1yzx2zt9d5w1jzgsb76060b
title: "max_nesting visibility: notice at create/update --parent, Tracker nesting doctor check, shared skip remedy"
kind: bug
status: open
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-1
dependencies: []
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-07T22:30:29.112Z
updated_at: 2026-09-07T22:31:40.810Z
---
GH #272. Nothing warns when a bead is created or re-parented past an enabled provider's max_nesting (create.ts and update.ts are tracker-unaware); doctor checks depth only against MAX_PARENT_DEPTH 10 (doctor.ts:1019-1035). (1) After the write in create/update --parent (single and bulk), when a provider is enabled and the bead is in its outbound selection and depthWithinSelection (mirror.ts:91-111) exceeds maxNesting, print a notice naming the remedy; compute the selection from the issues update already loads for the cycle check. (2) Doctor check 'Tracker nesting', offline, warn, listing excluded beads per provider (precedent: checkStateResolution, doctor.ts:924). (3) One shared skip-reason template for mirror.ts:236 and sync-engine.ts:900 that names the remedy. (4) Make maxNesting a required engine option: the private fallback options.maxNesting ?? 2 (sync-engine.ts:580) is the exact shape of the defect fixed at integration-runner.ts:567-573.
