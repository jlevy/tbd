---
type: is
id: is-01m222xy6md5svr7r89cdjkh1g
title: Build native-comment inventory and immutable transition engine
kind: task
status: in_progress
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
delegate: codex-native-comment-inventory
labels: []
dependencies:
  - type: blocks
    target: is-01m222ys2fv17vvxnr67rxhwq9
parent_id: is-01m220htdx8tv5k1mpjavfpsca
created_at: 2026-09-09T03:21:06.003Z
updated_at: 2026-09-09T04:30:09.604Z
---
Implement one bounded DataSyncInventory for comments and one deterministic immutable-transition engine. Validate exact sharded paths, fatal UTF-8, file modes, filename/embedded identity, canonical bytes, record and aggregate limits, and Git blob/index inputs. Accept only absent-to-valid-add or byte-identical existing records. Classify mutation, deletion, reparenting, invalid paths, and same-ID divergence; preserve raw alternatives with content-addressed provenance manifests. No public writer and no Git mutation integration in this layer.

## Notes

Implementing on codex/native-comment-inventory as the next layer above PR #282. Scope: one bounded filesystem/Git inventory contract, canonical path and byte validation, deterministic immutable-transition classification, and content-addressed quarantine artifacts. This branch adds no public CLI and does not yet hook mutations into sync, workspace, or recovery paths.
