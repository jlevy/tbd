---
type: is
id: is-01kxz33v74bq8rs2mxds42v35m
title: Implement tbd watch poll loop
kind: task
status: closed
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-07-19-bead-watch-and-external-sync.md
labels:
  - phase-1
  - bead-watch
dependencies:
  - type: blocks
    target: is-01kxz33vm42xvfs1f8gp0pgz6f
  - type: blocks
    target: is-01kxz33wzx4ptm5dap0761d7nq
parent_id: is-01kxz338d0vcwt6g87mcry4083
created_at: 2026-07-20T06:23:48.964Z
updated_at: 2026-07-20T07:11:43.655Z
closed_at: 2026-07-20T07:11:43.655Z
close_reason: Phase 1 implemented, repository gates passed, and live Claude Code/Codex cross-agent validation recorded in valid-2026-07-19-bead-watch-phase-1.md
---
Build ls-remote polling, explicit baselines, private-ref fetch/cleanup, timeout and error exit codes, selection wiring, and concurrency safety tests without touching the hidden worktree or lock.
