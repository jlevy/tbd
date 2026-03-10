---
type: is
id: is-01kf76664st5tb1eahc5ewct9j
title: "Bug: Dependency direction semantics confusing"
kind: bug
status: closed
priority: 2
version: 8
labels: []
dependencies: []
created_at: 2026-01-17T23:55:59.510Z
updated_at: 2026-03-09T16:12:31.209Z
closed_at: 2026-01-18T04:06:48.978Z
close_reason: "Fixed: dep add now uses 'issue depends on depends-on' semantics. Message updated to 'X now depends on Y'"
---
The dep add command semantics are inverted. Users expect 'dep add A B' to mean A depends on B, but current behavior means A blocks B. Fix options: change semantics, add flags, or improve docs.
