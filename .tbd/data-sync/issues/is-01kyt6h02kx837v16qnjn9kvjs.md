---
type: is
id: is-01kyt6h02kx837v16qnjn9kvjs
title: "PR #199 review R1: route typescript-lint-format-rules from skill baseline and review shortcuts"
kind: bug
status: closed
priority: 1
version: 2
labels: []
dependencies: []
parent_id: is-01kyt6gxft0hnqrk43mzba890t
created_at: 2026-07-30T19:02:55.315Z
updated_at: 2026-07-30T20:12:39.606Z
closed_at: 2026-07-30T20:12:39.606Z
close_reason: "Addressed in PR #199 round 2: guideline rewritten around the three-axis decision matrix with strictTypeChecked+stylisticTypeChecked default, honest Biome/checked-JS promise floor, biome ci --error-on-warnings, full verify-only gate (formatter+flowmark checks), tsconfig floor, and hook policy; satellites (pnpm Appendix C, bun Section 9) aligned; routing added to skill baseline and both review shortcuts with tests; this repo now applies the floor (strict presets, tsconfig flags, ci:quality pre-push/CI gate with uv in CI, config-contract check). Ratchets tracked: tbd-s9vn (no-unnecessary-condition), tbd-tdh3 (exactOptionalPropertyTypes)."
---
packages/tbd/docs/shortcuts/system/skill-baseline.md:79-82, review-code.md, review-code-typescript.md load only typescript-rules; add the floor guideline to those routes, cross-link from typescript-cli-tool-rules, regenerate surfaces. (PR #199, review at b0d9cbc)
