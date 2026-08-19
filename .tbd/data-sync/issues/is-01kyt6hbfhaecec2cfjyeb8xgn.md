---
type: is
id: is-01kyt6hbfhaecec2cfjyeb8xgn
title: "PR #199 review R6: add formatter and flowmark verify checks to gates"
kind: bug
status: closed
priority: 1
version: 2
labels: []
dependencies: []
parent_id: is-01kyt6gxft0hnqrk43mzba890t
created_at: 2026-07-30T19:03:06.993Z
updated_at: 2026-07-30T20:12:39.642Z
closed_at: 2026-07-30T20:12:39.642Z
close_reason: "Addressed in PR #199 round 2: guideline rewritten around the three-axis decision matrix with strictTypeChecked+stylisticTypeChecked default, honest Biome/checked-JS promise floor, biome ci --error-on-warnings, full verify-only gate (formatter+flowmark checks), tsconfig floor, and hook policy; satellites (pnpm Appendix C, bun Section 9) aligned; routing added to skill baseline and both review shortcuts with tests; this repo now applies the floor (strict presets, tsconfig flags, ci:quality pre-push/CI gate with uv in CI, config-contract check). Ratchets tracked: tbd-s9vn (no-unnecessary-condition), tbd-tdh3 (exactOptionalPropertyTypes)."
---
Full gate must include prettier/biome format check plus flowmark --check; add flowmark-rs --check to this repo's format:check, CI, and pre-push. (PR #199, review at b0d9cbc)
