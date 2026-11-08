---
type: is
id: is-01m6yj8m967n4bkda8tntbhj37
title: Upgrade zod to 4.6.7 for GHSA-mrhx-c7xc-m3w5
kind: bug
status: closed
priority: 1
version: 2
labels: []
dependencies: []
created_at: 2026-11-08T21:50:36.324Z
updated_at: 2026-11-08T22:38:20.512Z
closed_at: 2026-11-08T22:38:20.511Z
close_reason: "Delivered in jlevy/tbd#331: zod 4.6.7 (past the cool-off), schemas migrated with zod 3 behavior preserved for every value tbd reads or writes; pnpm audit --prod clean; lint, build, tests, and tryscript pass locally."
resolution: null
duplicate_of: null
---
pnpm audit --prod fails on GHSA-mrhx-c7xc-m3w5 (CVE-2023-54404, high): zod below 4.6.6 can exhaust memory while validating oversized constrained collections. tbd depends on zod ^3.25.76 and no 3.x backport exists, so upgrade to zod 4.6.7 (published 2026-10-12, past the 14-day cool-off) and migrate the 11 importing modules to zod 4 APIs. This currently fails the Coverage & Lint CI job on every PR.
