---
type: is
id: is-01kv199hk1mhj4qq0c1rhhkh31
title: "Bulk output contract: summary line, --json results, unsynced hint"
kind: task
status: open
priority: 1
version: 5
spec_path: docs/project/specs/active/plan-2026-06-13-agent-cli-ergonomics.md
labels: []
dependencies:
  - type: blocks
    target: is-01kv199ns2s6hs8zzxxf6vwkz5
parent_id: is-01kv197ns6jwkg2q82w7awjn15
child_order_hints:
  - is-01kv1cypk8qngr0vrqj81sfxhs
  - is-01kv1cyr0xsdj1gvkkmjjzgj15
created_at: 2026-06-13T20:03:10.561Z
updated_at: 2026-06-13T21:07:11.005Z
---
Spec problems P3/P4. Emit one deterministic summary line for multi-target writes (e.g. Closed 3, skipped 1). --json returns a results array results[{id,action,ok,skippedReason}] plus a summary object. Reuse the import unsynced-changes nudge. Make --quiet a single-line contract and suppress incidental stderr notices (worktree auto-heal, config migration) under --quiet so agents stop piping 2>&1 | tail -1. Related to tbd-tv5i (format option) but distinct: this is the agent output contract, not csv/yaml.

## Notes

PR #176 review: emit unsynced hint via output.notice() (visible by default), NOT output.info() (verbose-only, as import uses). --quiet stays silent on success; default text = one-line summary; --json = machine contract including sync pending+hint.
