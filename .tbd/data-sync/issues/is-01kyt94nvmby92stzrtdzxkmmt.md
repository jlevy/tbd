---
type: is
id: is-01kyt94nvmby92stzrtdzxkmmt
title: "Ratchet: enable exactOptionalPropertyTypes in tsconfig.base.json"
kind: chore
status: open
priority: 2
version: 2
labels:
  - pause
dependencies: []
created_at: 2026-07-30T19:48:37.361Z
updated_at: 2026-08-15T05:43:43.139Z
---
PR #199 review R8 prescribes exactOptionalPropertyTypes as part of the tsconfig floor. Enabling it today produces 42 errors in packages/tbd, so it needs a tracked migration: fix the optional-property writes, then add the flag to tsconfig.base.json. The other R8 flags (noImplicitOverride, noImplicitReturns, noFallthroughCasesInSwitch) passed cleanly and are already enabled.
