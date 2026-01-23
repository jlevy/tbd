---
close_reason: Not a bug - code correctly reads CURSOR.mdc in all fallback paths
closed_at: 2026-01-23T10:40:58.616Z
created_at: 2026-01-23T10:37:00.045Z
dependencies: []
id: is-01kfn6vg8ewaacyq132vm9dqzj
kind: bug
labels: []
priority: 2
status: closed
title: "setup.ts: cursor fallback reads wrong file"
type: is
updated_at: 2026-01-23T10:40:58.617Z
version: 2
---
loadCursorContent last fallback reads docs/SKILL.md instead of docs/CURSOR.mdc.
