---
type: is
id: is-01kfn3rg2tabsv2gstsxd2g8kz
title: Update shortcut command to exclude guidelines and templates
kind: task
status: closed
priority: 2
version: 7
labels: []
dependencies: []
parent_id: is-01kfn3qm96pv26s4bnntywy0ht
created_at: 2026-01-23T09:42:55.834Z
updated_at: 2026-03-09T16:12:32.478Z
closed_at: 2026-01-23T09:55:18.253Z
close_reason: Updated shortcut.ts to use DEFAULT_SHORTCUT_PATHS
---
Update shortcut.ts to use new DEFAULT_DOC_PATHS (without guidelines/templates subdirs). Shortcuts command should only show system and standard shortcuts. Update ShortcutHandler to use the extracted base class.
