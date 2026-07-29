---
type: is
id: is-01kxz33trkvwt06j0q3n26kwwy
title: Implement tbd changes diff engine
kind: task
status: closed
priority: 1
version: 7
spec_path: docs/project/specs/active/plan-2026-07-19-bead-watch-and-external-sync.md
labels:
  - phase-1
  - bead-watch
dependencies:
  - type: blocks
    target: is-01kxz33v74bq8rs2mxds42v35m
parent_id: is-01kxz338d0vcwt6g87mcry4083
created_at: 2026-07-20T06:23:48.498Z
updated_at: 2026-07-20T07:46:45.181Z
closed_at: 2026-07-20T07:11:43.627Z
close_reason: Phase 1 implemented, repository gates passed, and live Claude Code/Codex cross-agent validation recorded in valid-2026-07-19-bead-watch-phase-1.md
---
Build the strict ref snapshot reader, shared selection/readiness logic, deterministic per-field diff and text hunks, CLI output, exit 0/3 contract, and synthetic sync-branch history tests.

## Notes

Phase 1 CI hardening: transient Windows EBUSY fixture teardown locks use Node fs.rm recursive retries; the four Git-heavy CLI-watch integration cases use an explicit 15s per-test budget after Windows measured 6.0s against Vitest's 5s default; and the top-level CLI help transcript now includes changes/watch. Runtime behavior and assertions are unchanged. Exact local CI command passes: 94 Vitest files / 1399 tests plus 982 tryscript assertions.
