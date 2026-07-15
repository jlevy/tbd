---
type: is
id: is-01kv1cytrf9pfh7zgzmckprgvh
title: Tri-state sync intent in command context
kind: task
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-06-13-agent-cli-ergonomics.md
labels: []
dependencies: []
parent_id: is-01kv199mceva1eqhc1xd45ntxe
created_at: 2026-06-13T21:07:13.807Z
updated_at: 2026-06-14T15:53:27.613Z
closed_at: 2026-06-14T15:53:27.612Z
close_reason: Superseded by the 2026-06-14 decision to remove --no-sync and the dead ctx.sync field outright (commit 28e80ae) instead of modeling tri-state sync intent. Default is stage-only; tbd sync publishes. No tri-state needed.
---
Replace the boolean sync (opts.sync !== false, where absence reads true) with explicit intent unspecified|sync|no-sync. Default unspecified = stage-only. Keep --no-sync accepted as a documented no-op for issue writes.
