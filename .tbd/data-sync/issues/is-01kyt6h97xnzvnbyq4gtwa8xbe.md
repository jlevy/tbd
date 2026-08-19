---
type: is
id: is-01kyt6h97xnzvnbyq4gtwa8xbe
title: "PR #199 review R5: biome ci needs --error-on-warnings for the zero-warning gate"
kind: bug
status: closed
priority: 1
version: 2
labels: []
dependencies: []
parent_id: is-01kyt6gxft0hnqrk43mzba890t
created_at: 2026-07-30T19:03:04.701Z
updated_at: 2026-07-30T20:12:39.637Z
closed_at: 2026-07-30T20:12:39.637Z
close_reason: "Addressed in PR #199 round 2: guideline rewritten around the three-axis decision matrix with strictTypeChecked+stylisticTypeChecked default, honest Biome/checked-JS promise floor, biome ci --error-on-warnings, full verify-only gate (formatter+flowmark checks), tsconfig floor, and hook policy; satellites (pnpm Appendix C, bun Section 9) aligned; routing added to skill baseline and both review shortcuts with tests; this repo now applies the floor (strict presets, tsconfig flags, ci:quality pre-push/CI gate with uv in CI, config-contract check). Ratchets tracked: tbd-s9vn (no-unnecessary-condition), tbd-tdh3 (exactOptionalPropertyTypes)."
---
Guideline and bun-monorepo-patterns prescribe biome ci . while the floor says warnings fail; add --error-on-warnings everywhere. (PR #199, review at b0d9cbc)
