---
type: is
id: is-01kxz33trkvwt06j0q3n26kwwy
title: Implement tbd changes diff engine
kind: task
status: closed
priority: 1
version: 6
spec_path: docs/project/specs/active/plan-2026-07-19-bead-watch-and-external-sync.md
labels:
  - phase-1
  - bead-watch
dependencies:
  - type: blocks
    target: is-01kxz33v74bq8rs2mxds42v35m
parent_id: is-01kxz338d0vcwt6g87mcry4083
created_at: 2026-07-20T06:23:48.498Z
updated_at: 2026-07-20T07:33:58.402Z
closed_at: 2026-07-20T07:11:43.627Z
close_reason: Phase 1 implemented, repository gates passed, and live Claude Code/Codex cross-agent validation recorded in valid-2026-07-19-bead-watch-phase-1.md
---
Build the strict ref snapshot reader, shared selection/readiness logic, deterministic per-field diff and text hunks, CLI output, exit 0/3 contract, and synthetic sync-branch history tests.

## Notes

Windows CI follow-up: transient EBUSY locks during synthetic Git fixture teardown were addressed with Node fs.rm recursive retries (maxRetries 5, retryDelay 100ms). The next run showed the timeout-contract command returning correctly but the full fixture test taking 6.0s against Vitest's 5s default, so all four CLI-watch integration cases now have an explicit 15s per-test budget. Runtime timeout behavior and assertions are unchanged. Local format, lint/typecheck, focused tests, and full suite pass (94 files, 1399 tests).
