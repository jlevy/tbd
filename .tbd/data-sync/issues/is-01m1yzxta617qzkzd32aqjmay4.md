---
type: is
id: is-01m1yzxta617qzkzd32aqjmay4
title: "tbd list --children: per-row total/open/closed child counts in text and JSON"
kind: feature
status: open
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-3
dependencies:
  - type: blocks
    target: is-01m1yzy2kx8zrv658fwh0g4dqe
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-07T22:30:52.996Z
updated_at: 2026-09-07T22:31:44.291Z
---
GH #270. No command answers 'is this epic finished or never decomposed'; tbd list --all --parent <id> --count is one call per epic (274 calls for 137 epics), and the shortcut joins child_order_hints (internal ids) against parentId (display ids). Add --children: JSON children: {total, open, closed} per row, text column CHILDREN as open/total. Counts use parent_id, never hints, over all issues including closed, while rows stay filtered as before. tbd list --type epic --children is the epic view. Keep the pinned JSON shape (tests/cli-id-format.tryscript.md:87-120): the key appears only with --children.
