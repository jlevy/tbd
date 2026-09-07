---
type: is
id: is-01m1yzxfatdcswww2sm93j0djm
title: "doctor: Spec links group (dangling spec_path, epics without a spec, duplicate spec filenames) with --fix for moved paths"
kind: feature
status: open
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-2
dependencies: []
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-07T22:30:41.743Z
updated_at: 2026-09-07T22:31:42.391Z
---
GH #275. Doctor has zero spec_path references today; the reporter measured 279 of 941 spec-bearing beads dangling (213 with exactly one basename match elsewhere), 30 of 137 open epics with no spec_path, and one plan in both active/ and done/. Follow the checkForkedDocs group convention (doctor.ts:2405, zero findings when clean) and the exported-classifier convention (classifyNpmGlobalBin, clearableLockSidecars). Findings: dangling links by class (moved: fixable, --fix repoints under the shared lock, open and closed alike with separate counts; ambiguous: candidates listed; missing: listed with the bulk clear suggestion; on-branch: ok line naming the branch), epics without a spec (open epics, bulk suggestion), duplicate spec filenames (both paths and bead counts). Update tests/cli-orientation-golden.tryscript.md:74-146; e2e for --fix and for silence.
