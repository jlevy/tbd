---
type: is
id: is-01kra9b6k52jagayjr4sqzjhc7
title: tbd source add/list/remove/show with bundle-name auto-suggestion + preview
kind: task
status: open
priority: 2
version: 1
spec_path: docs/project/specs/active/plan-2026-05-07-docs-config-redesign.md
labels: []
dependencies: []
parent_id: is-01kra98tffpc00qar6ee3zk8tv
created_at: 2026-05-11T01:10:09.253Z
updated_at: 2026-05-11T01:10:09.253Z
---
Bundle-name auto-suggestion and confirmation preview. Dry-run inventory step is the core operation per design review.

Default-safe remove: refuse if explicit override edges point at that source unless --force-orphan.

Note: command shape depends on Q16 (bundle/source split — affects whether tbd bundle remove exists).

Spec: Phase 2 bullet 4 (line ~1652), Workflows W4, W6, W13.
