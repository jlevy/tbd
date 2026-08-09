---
type: is
id: is-01kyt6h4kjsvy1de1fdzkq9y5h
title: "PR #199 review R3: prescribe and apply strictTypeChecked plus stylisticTypeChecked"
kind: bug
status: closed
priority: 1
version: 2
labels: []
dependencies: []
parent_id: is-01kyt6gxft0hnqrk43mzba890t
created_at: 2026-07-30T19:02:59.954Z
updated_at: 2026-07-30T20:12:39.627Z
closed_at: 2026-07-30T20:12:39.627Z
close_reason: "Addressed in PR #199 round 2: guideline rewritten around the three-axis decision matrix with strictTypeChecked+stylisticTypeChecked default, honest Biome/checked-JS promise floor, biome ci --error-on-warnings, full verify-only gate (formatter+flowmark checks), tsconfig floor, and hook policy; satellites (pnpm Appendix C, bun Section 9) aligned; routing added to skill baseline and both review shortcuts with tests; this repo now applies the floor (strict presets, tsconfig flags, ci:quality pre-push/CI gate with uv in CI, config-contract check). Ratchets tracked: tbd-s9vn (no-unnecessary-condition), tbd-tdh3 (exactOptionalPropertyTypes)."
---
Guideline says strictest preset but configures recommendedTypeChecked; switch guideline, Appendix C, and this repo's eslint.config.js; fix or narrowly track resulting violations. (PR #199, review at b0d9cbc)
