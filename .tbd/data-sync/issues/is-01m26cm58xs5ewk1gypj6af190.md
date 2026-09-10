---
type: is
id: is-01m26cm58xs5ewk1gypj6af190
title: Stop search from marking stale state fresh without pulling
kind: bug
status: open
priority: 1
version: 1
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies: []
parent_id: is-01m1w3d1e63qg5e2wpz31qkmvn
created_at: 2026-09-10T19:27:29.048Z
updated_at: 2026-09-10T19:27:29.048Z
---
tbd search performs no Git/network refresh but writes last_sync_at; no sync path owns that field, so one search can suppress every later stale warning. Remove the misleading checkpoint write or implement a real pull, and add regression coverage.
