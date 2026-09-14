---
type: is
id: is-01m2esej1t36pzt1vqft3py13g
title: integration comment docs omit that plain tbd sync also delivers queued comments
kind: task
status: open
priority: 3
version: 1
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies: []
parent_id: is-01m1w3d1e63qg5e2wpz31qkmvn
created_at: 2026-09-14T01:45:32.473Z
updated_at: 2026-09-14T01:45:32.473Z
---
tbd-docs.md describes `tbd integration comment` delivery through `tbd integration sync` only, but the tbd sync fold also delivers queued comments (sync-engine.ts:1247). State both, and that on_tbd_sync: off disables the fold's delivery.
