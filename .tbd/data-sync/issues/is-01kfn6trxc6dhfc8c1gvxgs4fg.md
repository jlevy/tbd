---
type: is
id: is-01kfn6trxc6dhfc8c1gvxgs4fg
title: "setup.ts: fragile path construction with string replace"
kind: bug
status: closed
priority: 2
version: 7
labels: []
dependencies: []
created_at: 2026-01-23T10:36:36.139Z
updated_at: 2026-03-09T16:12:32.537Z
closed_at: 2026-01-23T10:38:33.351Z
close_reason: "Fixed: now uses join(targetDir, TBD_SHORTCUTS_DIR, subdir) instead of string replace"
---
Uses TBD_SHORTCUTS_SYSTEM.replace('system', subdir) instead of path constants directly.
