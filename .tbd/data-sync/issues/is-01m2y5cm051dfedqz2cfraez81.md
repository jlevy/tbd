---
type: is
id: is-01m2y5cm051dfedqz2cfraez81
title: "PR #309 J1: Preserve project text around quoted integration markers"
kind: bug
status: open
priority: 1
version: 1
labels: []
dependencies: []
parent_id: is-01m2y4ygvt317renehn2caprwa
created_at: 2026-09-20T01:02:48.323Z
updated_at: 2026-09-20T01:02:48.323Z
---
Review J https://github.com/jlevy/tbd/pull/309#issuecomment-5746574766. setup.ts writer uses substring boundaries; valid quoted begin mention causes user-text deletion and malformed grants. Fix shared line-anchored write boundaries and add CLI regression.
