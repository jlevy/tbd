---
type: is
id: is-01m1yzxjanhry6w9ns0dpppq6h
title: "tbd spec move <old> <new>: git mv, inbound link rewrite, bead repoint, with --dry-run"
kind: feature
status: open
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-2
dependencies:
  - type: blocks
    target: is-01m1yzy2kx8zrv658fwh0g4dqe
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-07T22:30:44.817Z
updated_at: 2026-09-07T22:31:42.480Z
---
GH #269 part 2 and #274 part 1. One command: (1) git mv (refuse if untracked or destination exists); (2) rewrite inbound Markdown links across tracked .md files whose resolved target is the old file, in all three shapes the reporter measured (specs/<folder>/<file> fragment under any prefix; bare and ./ sibling links resolved relative to the linking file), never prose mentions, reporting file and count; (3) repoint every bead whose spec_path names the old path as one bulk write under one lock with the sync hint. --dry-run previews all three. Composition of resolveSpecLocation, bulk --spec (Phase 3), and a unit-tested lib/markdown-links.ts rewriter. Fixture test: bare sibling link that must change and a same-basename link in another folder that must not.
