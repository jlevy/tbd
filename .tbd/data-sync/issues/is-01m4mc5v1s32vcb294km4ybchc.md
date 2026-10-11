---
type: is
id: is-01m4mc5v1s32vcb294km4ybchc
title: Isolate historical dependencies in packed upgrade proof
kind: bug
status: open
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
delegate: sol-pr324-fixes-01a127df
labels: []
dependencies: []
parent_id: is-01m4manp9y8srxqpyce3sbq1xe
hold: paused
created_at: 2026-10-11T02:20:25.528Z
updated_at: 2026-10-11T02:25:52.157Z
---
PR #324 head 845d55c: Ubuntu Node 24 passed 3045 tests but packed upgrade proof failed. extractPackage symlinks current dependencies into historical packages; old baseline imports removed gray-matter. Repair baseline dependency setup without restoring vulnerable production dependencies. Queued for sole writer after Astra review window. Evidence: actions run 38104346646 job 114366547604; external scratch ubuntu24-ci.log.

## Notes

— failing packed upgrade proof.** Historical published packages share candidate `node_modules`, so old baselines cannot import removed gray-matter. Proposed design, **not implemented or tested**: separate non-workspace historical runtime fixture, exact roots and 67-package closure/integrities from the reviewed original lock, installed frozen/prod with scripts disabled and cooldown retained. All five pinned baseline versions and published 0.10.0 have the same twelve dependency declarations. Link only historical clients to this fixture; candidate keeps its clean production graph. Explicitly reject unsupported baseline manifests. Known old dependency exposure must stay confined to trusted historical compatibility inputs. Validate isolation/install safeguards and run the packed proof.
