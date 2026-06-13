---
type: is
id: is-01kv1cyr0xsdj1gvkkmjjzgj15
title: Quiet contract + suppress incidental notices
kind: task
status: open
priority: 2
version: 1
spec_path: docs/project/specs/active/plan-2026-06-13-agent-cli-ergonomics.md
labels: []
dependencies: []
parent_id: is-01kv199hk1mhj4qq0c1rhhkh31
created_at: 2026-06-13T21:07:11.005Z
updated_at: 2026-06-13T21:07:11.005Z
---
Keep --quiet silent on success (preserve quiet-create golden). Suppress worktree-heal and config-migration stderr notices under --quiet so agents no longer need 2>&1 | tail -1. Add goldens for text vs quiet vs json.
