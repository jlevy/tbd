---
type: is
id: is-01m2k102z7ve3p96yr2hbacj3v
title: "PR #288 R6: test latest published client artifact"
kind: bug
status: closed
priority: 3
version: 3
labels: []
dependencies: []
parent_id: is-01m2k0zjx9mdxzfq5redfbzzyy
created_at: 2026-09-15T17:14:24.614Z
updated_at: 2026-09-15T18:35:49.139Z
closed_at: 2026-09-15T18:35:49.139Z
close_reason: "PR #288 follow-up review fully addressed in 3289adfa; reconciled with #289 in ca40c022, disposition published, targeted and full CLI tests passed, and all seven GitHub checks are green."
resolution: null
duplicate_of: null
---
Formal review 5213372082 R6. packages/tbd/scripts/validate-upgrade-package.mjs must pack and run the latest published artifact even when its manifest version equals the candidate version; version equality does not imply artifact equality.
