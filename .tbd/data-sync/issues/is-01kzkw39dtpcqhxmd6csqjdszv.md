---
type: is
id: is-01kzkw39dtpcqhxmd6csqjdszv
title: "PR #205 review R1: poll once at the timeout boundary"
kind: bug
status: closed
priority: 1
version: 3
labels: []
dependencies: []
parent_id: is-01kzkw2m9r8zz31np7zzgpdymp
created_at: 2026-08-09T18:20:55.609Z
updated_at: 2026-08-09T18:50:32.273Z
closed_at: 2026-08-09T18:50:32.272Z
close_reason: Implemented with regression coverage and passing repository quality gates
---
PR #205 R1. packages/tbd/src/file/bead-watch.ts:194-200. A completed final sleep returns timeout before observing remote movement. Add red-green boundary tests and make the final poll inclusive.
