---
type: is
id: is-01m1yzxfatdcswww2sm93j0djm
title: "doctor: Spec links group (dangling spec_path, epics without a spec, duplicate spec filenames) with --fix for moved paths"
kind: feature
status: open
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-2
dependencies: []
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-07T22:30:41.743Z
updated_at: 2026-09-13T23:17:48.197Z
---
GH #275. Doctor has zero spec_path references today; the reporter measured 279 of 941 spec-bearing beads dangling (213 with exactly one basename match elsewhere), 30 of 137 open epics with no spec_path, and one plan in both active/ and done/. Follow the checkForkedDocs group convention (doctor.ts:2405, zero findings when clean) and the exported-classifier convention (classifyNpmGlobalBin, clearableLockSidecars). Findings: dangling links by class (moved: fixable, --fix repoints under the shared lock, open and closed alike with separate counts; ambiguous: candidates listed; missing: listed with the bulk clear suggestion; on-branch: ok line naming the branch), epics without a spec (open epics, bulk suggestion), duplicate spec filenames (both paths and bead counts). Update tests/cli-orientation-golden.tryscript.md:74-146; e2e for --fix and for silence.

Revision 2026-09-13 (plan review against main and PRs #278-#283): --fix repoints a moved path only when trunk rename history confirms it (git log -M --diff-filter=R on the trunk ref); a basename-only match is reported, not auto-fixed. Expect findings for the 92 beads pointing at PR #278's plan and the 36 pre-repointed by PR #283's moves until those PRs merge; landing the stack before this bead avoids a round of false findings.
