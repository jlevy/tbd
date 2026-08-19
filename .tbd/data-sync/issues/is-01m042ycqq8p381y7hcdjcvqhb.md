---
type: is
id: is-01m042ycqq8p381y7hcdjcvqhb
title: Survey reference open-source Electron apps for real architecture patterns
kind: task
status: closed
priority: 1
version: 2
labels: []
dependencies: []
parent_id: is-01m042xcf06tnmqey8pcfwwswt
created_at: 2026-08-16T01:28:26.102Z
updated_at: 2026-08-16T01:50:08.700Z
closed_at: 2026-08-16T01:50:08.699Z
close_reason: "Surveyed VS Code, Signal, Bitwarden, Element, Joplin, Mattermost, Logseq, Standard Notes and current templates from their actual build configs. Findings are now section 8 of the guideline. Strongest signals: electron-builder used by 6 of 7 and Forge by none; CJS universal for main and preload; no app uses an IPC framework; Bitwarden and Element independently converged on the same fuse set."
---
Evidence base for the guideline: VS Code, Signal Desktop, Bitwarden, Element, Joplin, Mattermost and others. Extract patterns that appear in 3+ serious apps versus one-off choices.
