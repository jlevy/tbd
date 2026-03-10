---
type: is
id: is-01kfn6tf5z9t6j9s2gm7b72rwd
title: "setup.ts: shortcuts not installed during setup"
kind: bug
status: closed
priority: 2
version: 7
labels:
  - high-priority
dependencies: []
created_at: 2026-01-23T10:36:26.174Z
updated_at: 2026-03-09T16:12:32.519Z
closed_at: 2026-01-23T10:40:45.757Z
close_reason: "Fixed: copyDirFiles now creates destination directory with mkdir before copying"
---
copyBuiltinDocs() may fail because directories are not created before copying.
