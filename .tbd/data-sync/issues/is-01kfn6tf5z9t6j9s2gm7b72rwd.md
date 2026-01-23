---
close_reason: "Fixed: copyDirFiles now creates destination directory with mkdir before copying"
closed_at: 2026-01-23T10:40:45.757Z
created_at: 2026-01-23T10:36:26.174Z
dependencies: []
id: is-01kfn6tf5z9t6j9s2gm7b72rwd
kind: bug
labels:
  - high-priority
priority: 2
status: closed
title: "setup.ts: shortcuts not installed during setup"
type: is
updated_at: 2026-01-23T10:40:45.758Z
version: 2
---
copyBuiltinDocs() may fail because directories are not created before copying.
