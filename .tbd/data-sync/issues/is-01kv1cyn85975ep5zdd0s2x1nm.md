---
type: is
id: is-01kv1cyn85975ep5zdd0s2x1nm
title: Variadic update (bulk, constrained)
kind: task
status: open
priority: 1
version: 1
spec_path: docs/project/specs/active/plan-2026-06-13-agent-cli-ergonomics.md
labels: []
dependencies: []
parent_id: is-01kv199g5s0k58f2r5d0kcj9kb
created_at: 2026-06-13T21:07:08.165Z
updated_at: 2026-06-13T21:07:08.165Z
---
Accept <ids...>; apply shared FIELD updates to all (labels, priority, assignee, etc.). Reject per-ID-only flags (e.g. --title) when multiple IDs. Per PR #176 review: do NOT support bulk close via update --status closed (update does not set closed_at/close_reason); keep bulk closure on close. Reuse bulk.ts; add goldens.
