---
type: is
id: is-01kyt6h2bqfe5ctqqznb0vynzf
title: "PR #199 review R2: restructure guideline as decision matrix; decouple package manager, language, engine"
kind: bug
status: closed
priority: 1
version: 2
labels: []
dependencies: []
parent_id: is-01kyt6gxft0hnqrk43mzba890t
created_at: 2026-07-30T19:02:57.655Z
updated_at: 2026-07-30T20:12:39.620Z
closed_at: 2026-07-30T20:12:39.620Z
close_reason: "Addressed in PR #199 round 2: guideline rewritten around the three-axis decision matrix with strictTypeChecked+stylisticTypeChecked default, honest Biome/checked-JS promise floor, biome ci --error-on-warnings, full verify-only gate (formatter+flowmark checks), tsconfig floor, and hook policy; satellites (pnpm Appendix C, bun Section 9) aligned; routing added to skill baseline and both review shortcuts with tests; this repo now applies the floor (strict presets, tsconfig flags, ci:quality pre-push/CI gate with uv in CI, config-contract check). Ratchets tracked: tbd-s9vn (no-unnecessary-condition), tbd-tdh3 (exactOptionalPropertyTypes)."
---
Profiles couple pnpm/Bun with engine and language; no path for pnpm+checked-JS, Bun+TS+ESLint, pnpm+TS+Biome; ESLint example scopes floor rules to ts/tsx only; list supported extensions. (PR #199, review at b0d9cbc)
