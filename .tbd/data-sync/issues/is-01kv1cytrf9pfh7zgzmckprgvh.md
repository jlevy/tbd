---
type: is
id: is-01kv1cytrf9pfh7zgzmckprgvh
title: Tri-state sync intent in command context
kind: task
status: open
priority: 2
version: 1
spec_path: docs/project/specs/active/plan-2026-06-13-agent-cli-ergonomics.md
labels: []
dependencies: []
parent_id: is-01kv199mceva1eqhc1xd45ntxe
created_at: 2026-06-13T21:07:13.807Z
updated_at: 2026-06-13T21:07:13.807Z
---
Replace the boolean sync (opts.sync !== false, where absence reads true) with explicit intent unspecified|sync|no-sync. Default unspecified = stage-only. Keep --no-sync accepted as a documented no-op for issue writes.
