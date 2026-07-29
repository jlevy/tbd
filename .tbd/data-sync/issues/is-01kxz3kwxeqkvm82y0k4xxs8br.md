---
type: is
id: is-01kxz3kwxeqkvm82y0k4xxs8br
title: "Fix extensions merge: lww → deep_merge_by_key per design §3.5"
kind: bug
status: open
priority: 1
version: 1
spec_path: docs/project/specs/active/plan-2026-07-20-linear-bead-sync-pilot.md
labels:
  - linear-sync
dependencies: []
parent_id: is-01kxz3kfz7n7y23n9rzmy28f98
created_at: 2026-07-20T06:32:34.989Z
updated_at: 2026-07-20T06:32:34.989Z
---
packages/tbd/src/file/git.ts:407 merges BaseEntity.extensions as whole-object LWW; design doc §3.5 specifies deep_merge_by_key (union namespaces, per-key LWW, attic on loss). Current behavior silently drops one side when two writers touch different namespaces — a data-loss hazard for any bridge metadata. Phase 0 of the Linear sync pilot spec.
