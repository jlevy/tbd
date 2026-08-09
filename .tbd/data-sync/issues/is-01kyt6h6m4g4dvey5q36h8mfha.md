---
type: is
id: is-01kyt6h6m4g4dvey5q36h8mfha
title: "PR #199 review R4: honest promise-safety floor for Biome and checked JS"
kind: bug
status: closed
priority: 1
version: 2
labels: []
dependencies: []
parent_id: is-01kyt6gxft0hnqrk43mzba890t
created_at: 2026-07-30T19:03:02.020Z
updated_at: 2026-07-30T20:12:39.632Z
closed_at: 2026-07-30T20:12:39.632Z
close_reason: "Addressed in PR #199 round 2: guideline rewritten around the three-axis decision matrix with strictTypeChecked+stylisticTypeChecked default, honest Biome/checked-JS promise floor, biome ci --error-on-warnings, full verify-only gate (formatter+flowmark checks), tsconfig floor, and hook policy; satellites (pnpm Appendix C, bun Section 9) aligned; routing added to skill baseline and both review shortcuts with tests; this repo now applies the floor (strict presets, tsconfig flags, ci:quality pre-push/CI gate with uv in CI, config-contract check). Ratchets tracked: tbd-s9vn (no-unnecessary-condition), tbd-tdh3 (exactOptionalPropertyTypes)."
---
tsc does not diagnose floating promises; enable Biome type-domain nursery rules for TS with caveats; prescribe type-aware typescript-eslint as the promise gate for checked JS or label Biome-only JS a lower floor; fix smoke-test wording. (PR #199, review at b0d9cbc)
