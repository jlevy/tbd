---
type: is
id: is-01kxz3kwxeqkvm82y0k4xxs8br
title: "Fix extensions merge: lww → deep_merge_by_key per design §3.5"
kind: bug
status: closed
priority: 1
version: 7
spec_path: docs/project/specs/active/plan-2026-07-19-bead-watch-and-external-sync.md
labels:
  - linear-sync
dependencies:
  - type: blocks
    target: is-01kxz3mf4ytsqe23z53h0z8c7q
parent_id: is-01kxz3kfz7n7y23n9rzmy28f98
created_at: 2026-07-20T06:32:34.989Z
updated_at: 2026-08-15T05:33:52.214Z
closed_at: 2026-08-15T05:33:52.213Z
close_reason: "Fixed in merged PR #206: extension data now uses namespace-aware merge semantics."
extensions:
  linear:
    id: 6fb042cf-05ec-4bb9-b06b-ffb10b7d2dc0
    key: TBD-8
    url: https://linear.app/finterm-ai/issue/TBD-8/fix-extensions-merge-lww-deep-merge-by-key-per-design-35
    linked_at: 2026-08-10T19:37:28.841Z
---
packages/tbd/src/file/git.ts:407 merges BaseEntity.extensions as whole-object LWW; design doc §3.5 specifies deep_merge_by_key (union namespaces, per-key LWW, attic on loss). Current behavior silently drops one side when two writers touch different namespaces — a data-loss hazard for any bridge metadata. Phase 0 of the Linear sync pilot spec.

## Notes

Generic integration-layer safety foundation under the active plan. It is not required for PR #205 watch merge or release; it is required before concurrent provider namespaces can safely write extensions.
