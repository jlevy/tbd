---
type: is
id: is-01kfm8se8tzgwqv1jdze8rd3n4
title: Remove prefix auto-detection from code
kind: task
status: closed
priority: 1
version: 10
labels: []
dependencies:
  - type: blocks
    target: is-01kfm8sxw5a0wckwm1vtk3rqqr
  - type: blocks
    target: is-01kfm8t5j0zepm5h3n4vx8tv6a
created_at: 2026-01-23T01:51:35.193Z
updated_at: 2026-03-09T16:12:32.236Z
closed_at: 2026-01-23T01:57:40.882Z
close_reason: "Implemented: removed autoDetectPrefix and related functions, setup now requires --prefix"
---
Remove the autoDetectPrefix function and its usages from the codebase.

Files to modify:
- packages/tbd/src/cli/lib/prefix-detection.ts - Remove autoDetectPrefix, getGitRemoteUrl, extractRepoNameFromRemote functions (keep normalizePrefix, isValidPrefix, getBeadsPrefix)
- packages/tbd/src/cli/commands/setup.ts - Remove calls to autoDetectPrefix, require --prefix flag when not doing beads migration
- packages/tbd/tests/prefix-detection.test.ts - Remove tests for removed functions

Behavior changes:
- tbd setup --auto without --prefix should error with helpful message (unless migrating from beads)
- tbd setup --from-beads should still work (gets prefix from beads config)
- Keep getBeadsPrefix for beads migration use case
