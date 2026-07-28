---
type: is
id: is-01kv1b1bbc8zjprnm79nqyaeh4
title: "Bulk show (read-only): show A B C -> delimited text / --json array"
kind: task
status: open
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-07-28-agent-cli-bash-fallbacks.md
labels: []
dependencies:
  - type: blocks
    target: is-01kyknk22z7tn952q0hcwf7h27
parent_id: is-01kyknjks7f7mm37tzt7mntc4k
created_at: 2026-06-13T20:33:39.180Z
updated_at: 2026-07-28T06:11:45.329Z
---
Separate read-only design split out of the mutator slice per PR #176 review. tbd show A B C renders each issue with a delimiter; --json returns an array. No write lock, no summary/sync/quiet-mutator contract. Independent of the variadic mutators (tbd-38ov).
