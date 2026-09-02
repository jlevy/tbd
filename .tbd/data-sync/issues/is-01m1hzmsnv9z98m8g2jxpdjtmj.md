---
type: is
id: is-01m1hzmsnv9z98m8g2jxpdjtmj
title: "PR #264 review R4: the wiring that was broken is still untested"
kind: bug
status: closed
priority: 2
version: 2
labels: []
dependencies: []
parent_id: is-01m1hzmrdcgkf45b2nf8mhqghq
created_at: 2026-09-02T21:15:49.818Z
updated_at: 2026-09-02T21:43:54.702Z
closed_at: 2026-09-02T21:43:54.701Z
close_reason: "Fixed in c1235d3c on PR #264; disposition map posted as issuecomment-5516854053."
resolution: null
duplicate_of: null
---
list.ts:219-222, doc-cache.ts:628. Dropping the category arg at the generateShortcutDirectory call site passes 43/43. Nothing exercises --defer-before through commander. Extend cli-edge-cases.tryscript.md:386 and add a routing test.
