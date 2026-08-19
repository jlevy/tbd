---
type: is
id: is-01kzkw39tv51h8n8tjcwd6y7we
title: "PR #205 review R2: bound watch Git operations by deadline"
kind: bug
status: closed
priority: 1
version: 3
labels: []
dependencies: []
parent_id: is-01kzkw2m9r8zz31np7zzgpdymp
created_at: 2026-08-09T18:20:56.026Z
updated_at: 2026-08-09T18:50:32.291Z
closed_at: 2026-08-09T18:50:32.291Z
close_reason: Implemented with regression coverage and passing repository quality gates
---
PR #205 R2. packages/tbd/src/file/bead-watch.ts:110-145. Propagate the watch deadline to ls-remote and fetch so a hung Git process cannot outlive --timeout; preserve cleanup and error semantics.
