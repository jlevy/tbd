---
type: is
id: is-01kzqwd0x3zbne15mf42kr6x4j
title: "PR #206 Bugbot R1: sync_on_tbd_sync fold ran after the push, stranding its commits"
kind: bug
status: closed
priority: 2
version: 2
labels: []
dependencies: []
parent_id: is-01kzqms8fz0d4dyfw4wsm8djfs
created_at: 2026-08-11T07:43:12.290Z
updated_at: 2026-08-11T07:43:19.394Z
closed_at: 2026-08-11T07:43:19.393Z
close_reason: Fixed in 9b30be4c with regression coverage; threads resolved, disposition on the PR.
---
High. Fixed in 9b30be4c: fold moved before the git phases so its writes ride the same commit+push; failures degrade, never block. Manual updated.
