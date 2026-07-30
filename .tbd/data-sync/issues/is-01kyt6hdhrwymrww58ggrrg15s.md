---
type: is
id: is-01kyt6hdhrwymrww58ggrrg15s
title: "PR #199 review R7: fix this repo's lefthook to match the mandatory hook policy"
kind: bug
status: closed
priority: 1
version: 2
labels: []
dependencies: []
parent_id: is-01kyt6gxft0hnqrk43mzba890t
created_at: 2026-07-30T19:03:09.111Z
updated_at: 2026-07-30T20:12:39.647Z
closed_at: 2026-07-30T20:12:39.647Z
close_reason: "Addressed in PR #199 round 2: guideline rewritten around the three-axis decision matrix with strictTypeChecked+stylisticTypeChecked default, honest Biome/checked-JS promise floor, biome ci --error-on-warnings, full verify-only gate (formatter+flowmark checks), tsconfig floor, and hook policy; satellites (pnpm Appendix C, bun Section 9) aligned; routing added to skill baseline and both review shortcuts with tests; this repo now applies the floor (strict presets, tsconfig flags, ci:quality pre-push/CI gate with uv in CI, config-contract check). Ratchets tracked: tbd-s9vn (no-unnecessary-condition), tbd-tdh3 (exactOptionalPropertyTypes)."
---
parallel: true makes priorities inert and races stage_fixed on the index; set parallel: false, use pinned pnpm exec commands not npx fallbacks, add verify gate to pre-push. (PR #199, review at b0d9cbc)
