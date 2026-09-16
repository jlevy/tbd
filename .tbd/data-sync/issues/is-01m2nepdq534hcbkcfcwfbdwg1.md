---
type: is
id: is-01m2nepdq534hcbkcfcwfbdwg1
title: Guide stale shortcut caches to setup refresh
kind: bug
status: closed
priority: 1
version: 5
delegate: codex@spud10
labels:
  - cli
  - docs
dependencies: []
hold: null
hold_until: null
created_at: 2026-09-16T15:52:16.869Z
updated_at: 2026-09-16T16:53:58.026Z
started_at: 2026-09-16T15:53:12.737Z
closed_at: 2026-09-16T16:53:58.025Z
close_reason: Implemented with focused setup, routing, transcript, installer, and packed-upgrade coverage.
resolution: null
duplicate_of: null
---
When a repository cache predates an installed bundled shortcut such as stacked-prs, a shortcut lookup reports only that no shortcut was found and points to --list. Detect this stale managed-doc cache case and direct the operator to run tbd setup --auto, while preserving the ordinary unknown-name diagnostic. Add focused regression coverage for single lookup and relevant list/discovery behavior.

## Notes

Exact bundled shortcut misses are detected before fuzzy matching, including batch prefix collisions. The diagnostic points to tbd setup --auto; setup restoration, generated routing, and legacy unknown-name behavior are covered by a 22-case tryscript.
