---
type: is
id: is-01ktxg4s1ng4wz60bnh3frcsc0
title: "Phase 2: shared docmap renderer + tbd docs list/show; migrate per-kind --list --json to docmap"
kind: task
status: in_progress
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels: []
dependencies: []
parent_id: is-01ktxg3eqj62dhphs6dnbb30jf
created_at: 2026-06-12T08:45:56.660Z
updated_at: 2026-06-12T20:50:35.960Z
---

## Notes

Scope after PR #169 re-homing (3c718c0/e5ce028): cross-kind list + kind-agnostic show SHIPPED; docs list --json already emits docmap. REMAINING: (a) per-kind guidelines/shortcut/template --list --json migrate flat array -> docmap (Decision 21); (b) consolidate text rendering through one shared docmap renderer (Decision 22) so list/status/overview/per-kind lists derive from one DocMap; (c) per-kind readers print the '(serving forked copy: ...)' stderr provenance note when serving from fork dir (Decision 18 — show already does); (d) single-doc read --json emits docmap entry + content field per the one-model contract; (e) cli-doc-output guidelines--json golden rewrite.
