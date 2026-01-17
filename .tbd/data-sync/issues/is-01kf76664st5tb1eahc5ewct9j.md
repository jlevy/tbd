---
created_at: 2026-01-17T23:55:59.510Z
dependencies: []
id: is-01kf76664st5tb1eahc5ewct9j
kind: bug
labels: []
priority: 2
status: open
title: "Bug: Dependency direction semantics confusing"
type: is
updated_at: 2026-01-17T23:55:59.510Z
version: 1
---
The dep add command semantics are inverted. Users expect 'dep add A B' to mean A depends on B, but current behavior means A blocks B. Fix options: change semantics, add flags, or improve docs.
