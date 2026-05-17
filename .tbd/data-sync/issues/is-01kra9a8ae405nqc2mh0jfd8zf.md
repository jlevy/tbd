---
type: is
id: is-01kra9a8ae405nqc2mh0jfd8zf
title: "Source resolution: walk sources in order, produce (bundle, type, name) → path map"
kind: task
status: open
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-05-07-docs-config-redesign.md
labels: []
dependencies:
  - type: blocks
    target: is-01kra9a8p986pwpazqavzragar
  - type: blocks
    target: is-01kra9a9rgnw0ea5171yg7e317
parent_id: is-01kra98szn2ah4f59kmbnfbery
created_at: 2026-05-11T01:09:38.254Z
updated_at: 2026-05-11T01:11:12.018Z
---
Walk sources: in declared order, produce a (bundle, type, name) → file path map. Auto-detection (subdir-name matching) for now; explicit contents mapping wired in but lightly tested (heavy testing in Phase 2).

Note: scope may shift if Q20b (glob-only matching) lands in Phase 1 — drops auto-detection in favor of explicit contents.

Spec: Phase 1 bullet 4 (line ~1611).
