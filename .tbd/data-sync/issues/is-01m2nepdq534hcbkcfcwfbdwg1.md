---
type: is
id: is-01m2nepdq534hcbkcfcwfbdwg1
title: Guide stale shortcut caches to setup refresh
kind: bug
status: in_progress
priority: 1
version: 3
delegate: codex@spud10
labels:
  - cli
  - docs
dependencies: []
hold: null
hold_until: null
created_at: 2026-09-16T15:52:16.869Z
updated_at: 2026-09-16T15:53:12.738Z
started_at: 2026-09-16T15:53:12.737Z
---
When a repository cache predates an installed bundled shortcut such as stacked-prs, a shortcut lookup reports only that no shortcut was found and points to --list. Detect this stale managed-doc cache case and direct the operator to run tbd setup --auto, while preserving the ordinary unknown-name diagnostic. Add focused regression coverage for single lookup and relevant list/discovery behavior.
