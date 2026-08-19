---
type: is
id: is-01m0dsa6yx7pcwybmmspf947q2
title: tbd sessions and tbd sessions refresh commands
kind: feature
status: open
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-19-agent-session-refs-and-runtimes.md
labels: []
dependencies: []
parent_id: is-01m0drveqd06azafyxnbqx0e4h
created_at: 2026-08-19T19:52:31.964Z
updated_at: 2026-08-19T23:48:38.059Z
extensions:
  linear:
    id: a39455e8-7f3d-4e1b-bc37-89136aa1f3de
    linked_at: 2026-08-19T23:48:38.059Z
---
tbd sessions lists known sessions with status and age, --json for scripting. tbd sessions refresh [id] polls adapters and updates local state. Works with only the local provider before any adapter exists.
