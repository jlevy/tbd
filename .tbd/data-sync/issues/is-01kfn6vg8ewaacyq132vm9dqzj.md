---
type: is
id: is-01kfn6vg8ewaacyq132vm9dqzj
title: "setup.ts: cursor fallback reads wrong file"
kind: bug
status: closed
priority: 2
version: 7
labels: []
dependencies: []
created_at: 2026-01-23T10:37:00.045Z
updated_at: 2026-03-09T16:12:32.559Z
closed_at: 2026-01-23T10:40:58.616Z
close_reason: Not a bug - code correctly reads CURSOR.mdc in all fallback paths
---
loadCursorContent last fallback reads docs/SKILL.md instead of docs/CURSOR.mdc.
