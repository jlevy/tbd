---
type: is
id: is-01kzm0f2h25zhbt3jn81p8dt6b
title: Bound fetched-tip resolution by the poll deadline
kind: bug
status: open
priority: 1
version: 1
labels: []
dependencies: []
parent_id: is-01kzkw2m9r8zz31np7zzgpdymp
created_at: 2026-08-09T19:37:16.065Z
updated_at: 2026-08-09T19:37:16.065Z
---
PR #205 review follow-up: fetchRemoteTip times out git fetch but resolves the private ref with untimed git rev-parse. Share one positive wall-time budget across both subprocesses and add a regression proving the remaining timeout is passed to rev-parse.
