---
type: is
id: is-01m0ermrx52bke3qyg04re1kbc
title: Live-verify directory-bound assignment end to end
kind: task
status: in_progress
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-18-tracker-state-model-and-linear-mapping.md
delegate: claude-code@spud10
labels: []
dependencies: []
parent_id: is-01m0ermjzgy620e6gx9mtp7z9d
hold: null
hold_until: null
created_at: 2026-08-20T05:00:03.876Z
updated_at: 2026-08-20T05:13:31.841Z
started_at: 2026-08-20T05:13:31.840Z
---
Actor Phase 2 is implemented and unit-covered but never exercised against the real API, because the OS-351 fix requires field_sync.fields.assignee: merge and this repo has not set it. Set it deliberately, confirm a handle resolves through the workspace directory, binds by provider user id under bridge/linear/users/, and publishes; then revert the config.
