---
type: is
id: is-01m26cmekn2rjwt00kp2rggbfx
title: Keep Beads enabled when setup import fails
kind: bug
status: open
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies: []
parent_id: is-01m1w3d1e63qg5e2wpz31qkmvn
created_at: 2026-09-10T19:27:38.607Z
updated_at: 2026-09-10T19:36:20.980Z
---
tbd setup --from-beads can disable .beads after import failure. The outer setup catches a thrown import error and continues, while the importer also increments imported/merged before writeIssue and swallows per-issue write failures, so it can return success with overstated counts. Make import fail honestly, and abort before disabling the prior tracker unless every required write succeeds; add failure-injection and recovery regressions.
