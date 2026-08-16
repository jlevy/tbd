---
type: is
id: is-01kzzesqaq108cbnbkhwvhb2rk
title: Investigate tbd sync false push-failure reporting under concurrent metadata sync
kind: bug
status: open
priority: 2
version: 1
labels:
  - sync
dependencies: []
created_at: 2026-08-14T06:19:23.848Z
updated_at: 2026-08-14T06:19:23.848Z
---
During the v0.6.0 release review, two tbd sync attempts reported failed-to-push and claimed two commits remained local, but origin/tbd-sync subsequently resolved to the exact local HEAD and a retry reported already in sync. Reproduce concurrent git-common-dir-v1 syncs, distinguish hook rejection from non-fast-forward races, and make success/failure reporting reflect the final remote ref. This is operational follow-up; the issue branch is currently verified synchronized.
