---
type: is
id: is-01kzm0f2h25zhbt3jn81p8dt6b
title: Bound fetched-tip resolution by the poll deadline
kind: bug
status: closed
priority: 1
version: 2
labels: []
dependencies: []
parent_id: is-01kzkw2m9r8zz31np7zzgpdymp
created_at: 2026-08-09T19:37:16.065Z
updated_at: 2026-08-09T19:49:15.583Z
closed_at: 2026-08-09T19:49:15.582Z
close_reason: Implemented one shared deadline across fetch and private-ref resolution in 5b23f7f8, added remaining-budget regression coverage, resolved the review thread, and verified all final-head checks green.
---
PR #205 review follow-up: fetchRemoteTip times out git fetch but resolves the private ref with untimed git rev-parse. Share one positive wall-time budget across both subprocesses and add a regression proving the remaining timeout is passed to rev-parse.
