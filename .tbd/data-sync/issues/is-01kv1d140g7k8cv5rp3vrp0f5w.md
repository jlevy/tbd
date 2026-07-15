---
type: is
id: is-01kv1d140g7k8cv5rp3vrp0f5w
title: Add --sync flag with lock-release-then-sync boundary
kind: task
status: deferred
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-06-13-agent-cli-ergonomics.md
labels: []
dependencies: []
parent_id: is-01kv199mceva1eqhc1xd45ntxe
created_at: 2026-06-13T21:08:28.816Z
updated_at: 2026-06-14T15:53:33.792Z
---
Add --sync to mutators: apply all writes under one lock, RELEASE it, then run the sync path (which re-takes the same non-reentrant lock and does network I/O). One push per batch. Tests: --sync syncs, absent does not, --no-sync no-op, no nested-lock deadlock. Depends on the tri-state intent task.
