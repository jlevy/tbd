---
type: is
id: is-01kyt6hfjrjfz7jjrewbee3ydr
title: "PR #199 review R8: publish an explicit tsconfig floor and enable passing flags here"
kind: bug
status: closed
priority: 1
version: 2
labels: []
dependencies: []
parent_id: is-01kyt6gxft0hnqrk43mzba890t
created_at: 2026-07-30T19:03:11.191Z
updated_at: 2026-07-30T20:12:39.651Z
closed_at: 2026-07-30T20:12:39.651Z
close_reason: "Addressed in PR #199 round 2: guideline rewritten around the three-axis decision matrix with strictTypeChecked+stylisticTypeChecked default, honest Biome/checked-JS promise floor, biome ci --error-on-warnings, full verify-only gate (formatter+flowmark checks), tsconfig floor, and hook policy; satellites (pnpm Appendix C, bun Section 9) aligned; routing added to skill baseline and both review shortcuts with tests; this repo now applies the floor (strict presets, tsconfig flags, ci:quality pre-push/CI gate with uv in CI, config-contract check). Ratchets tracked: tbd-s9vn (no-unnecessary-condition), tbd-tdh3 (exactOptionalPropertyTypes)."
---
Add noUncheckedIndexedAccess, exactOptionalPropertyTypes, noImplicitOverride, noImplicitReturns, noFallthroughCasesInSwitch, verbatimModuleSyntax guidance; enable the passing flags in tsconfig.base.json; ratchet exactOptionalPropertyTypes. (PR #199, review at b0d9cbc)
