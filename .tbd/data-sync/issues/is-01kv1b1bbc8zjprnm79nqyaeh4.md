---
type: is
id: is-01kv1b1bbc8zjprnm79nqyaeh4
title: "Bulk show (read-only): show A B C -> delimited text / --json array"
kind: task
status: open
priority: 3
version: 1
spec_path: docs/project/specs/active/plan-2026-06-13-agent-cli-ergonomics.md
labels: []
dependencies: []
parent_id: is-01kv197ns6jwkg2q82w7awjn15
created_at: 2026-06-13T20:33:39.180Z
updated_at: 2026-06-13T20:33:39.180Z
---
Separate read-only design split out of the mutator slice per PR #176 review. tbd show A B C renders each issue with a delimiter; --json returns an array. No write lock, no summary/sync/quiet-mutator contract. Independent of the variadic mutators (tbd-38ov).
