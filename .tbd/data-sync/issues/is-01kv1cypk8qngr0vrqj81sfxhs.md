---
type: is
id: is-01kv1cypk8qngr0vrqj81sfxhs
title: Extract shared bulk emitter from close
kind: task
status: open
priority: 2
version: 1
spec_path: docs/project/specs/active/plan-2026-06-13-agent-cli-ergonomics.md
labels: []
dependencies: []
parent_id: is-01kv199hk1mhj4qq0c1rhhkh31
created_at: 2026-06-13T21:07:09.544Z
updated_at: 2026-06-13T21:07:09.544Z
---
Generalize the one-line summary + --json results array (results[], summary, sync pending/hint) currently inline in close.ts into a shared emitter in cli/lib/bulk.ts so reopen/update reuse it identically.
