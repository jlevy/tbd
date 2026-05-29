---
type: is
id: is-01kss6e6b9h6wtypdfxdmawt08
title: "[bug] release.yml CHANGELOG extraction always returns empty; releases ship with fallback body"
kind: bug
status: open
priority: 1
version: 1
spec_path: tests/qa/release-v0.2.0-upgrade.qa.md
labels:
  - v0.2.0
  - release-blocker
dependencies: []
parent_id: is-01ksrpb7b8cfwrzzd34ya9874q
created_at: 2026-05-29T06:23:39.876Z
updated_at: 2026-05-29T06:23:39.876Z
---
v0.2.0 and v0.1.30 (and likely every prior release) shipped with the GitHub Release body set to 'Release vX.Y.Z' instead of the '## X.Y.Z' CHANGELOG section. Diagnosed in .github/workflows/release.yml step 'Extract changelog for this version': the awk range pattern /^## X\\.Y\\.Z$/,/^## [0-9]/ collapses to a single line because the start pattern (## 0.2.0) also matches the end pattern (a ## followed by a digit). The fallback CHANGELOG=Release vVERSION then takes over silently.

Fix landed in this branch: rewrite to use a flag-based awk that prints the start line, then exits at the NEXT ^## [0-9] heading. Verified locally on v0.2.0's section (71 lines, full body extracted).

Backfilled v0.2.0 GH release with the correct body via gh release edit. v0.1.30 still has the fallback body; backfill optional.

Acceptance:
- Next release tagged after this commit produces a GH Release whose body is the full ## X.Y.Z section.
- A unit-ish check: run the awk in this workflow locally against the committed CHANGELOG and confirm the section is fully extracted.
