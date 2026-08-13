---
type: is
id: is-01kzyh1k4k5yy6k2s5vra3gs8s
title: "integration status: warn when .env is absent but would not be gitignored"
kind: task
status: open
priority: 3
version: 1
labels: []
dependencies: []
created_at: 2026-08-13T21:39:24.434Z
updated_at: 2026-08-13T21:39:24.434Z
---
status.ts:76-84 returns 'ok: not present' when no .env exists, without checking whether one WOULD be ignored if created. An agent following the setup docs could create .env in a repo lacking the ignore rule and only then discover the error -- after the key is on disk.

Fix: when .env is absent, still run git check-ignore against the path and emit a warn-level finding if it would not be ignored. The new setup-linear shortcut documents a manual pre-check as a stopgap.
