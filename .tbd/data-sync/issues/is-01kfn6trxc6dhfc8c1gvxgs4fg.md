---
close_reason: "Fixed: now uses join(targetDir, TBD_SHORTCUTS_DIR, subdir) instead of string replace"
closed_at: 2026-01-23T10:38:33.351Z
created_at: 2026-01-23T10:36:36.139Z
dependencies: []
id: is-01kfn6trxc6dhfc8c1gvxgs4fg
kind: bug
labels: []
priority: 2
status: closed
title: "setup.ts: fragile path construction with string replace"
type: is
updated_at: 2026-01-23T10:38:33.352Z
version: 2
---
Uses TBD_SHORTCUTS_SYSTEM.replace('system', subdir) instead of path constants directly.
