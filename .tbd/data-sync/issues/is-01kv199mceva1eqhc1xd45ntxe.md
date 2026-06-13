---
type: is
id: is-01kv199mceva1eqhc1xd45ntxe
title: Opt-in --sync and honest stage-then-publish model
kind: task
status: open
priority: 2
version: 4
spec_path: docs/project/specs/active/plan-2026-06-13-agent-cli-ergonomics.md
labels: []
dependencies:
  - type: blocks
    target: is-01kv199ns2s6hs8zzxxf6vwkz5
parent_id: is-01kv197ns6jwkg2q82w7awjn15
child_order_hints:
  - is-01kv1cytrf9pfh7zgzmckprgvh
created_at: 2026-06-13T20:03:13.422Z
updated_at: 2026-06-13T21:07:13.807Z
---
Spec problem P5 (resolved: stage plus opt-in --sync). Keep stage-then-publish: writes land in the sync worktree and tbd sync publishes. Add --sync to mutators to publish once at the end of the operation. Print an unsynced-changes hint when changes are pending. Document --no-sync as a no-op for issue writes; no per-command auto-sync. Update the manual and tbd prime.

## Notes

PR #176 review: tri-state sync intent unspecified/sync/no-sync; absence is not true (getCommandContext uses sync: opts.sync !== false). Lock boundary: write under lock, release, THEN sync (no nested non-reentrant lock). Extend sync doc fixes to tbd-design.md and tbd-docs.md.
