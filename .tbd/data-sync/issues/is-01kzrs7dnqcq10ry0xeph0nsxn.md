---
type: is
id: is-01kzrs7dnqcq10ry0xeph0nsxn
title: "Phase 2.5: extract runIssueSync from SyncHandler.fullSync with parity coverage"
kind: task
status: closed
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
  - refactor
  - pr-207
dependencies:
  - type: blocks
    target: is-01kzrs87qg5tssg8p41wpj3kwj
parent_id: is-01kzq6vbaqck3q21a69965ha4e
created_at: 2026-08-11T16:06:57.462Z
updated_at: 2026-08-11T16:18:41.972Z
closed_at: 2026-08-11T16:18:41.971Z
close_reason: Extracted packages/tbd/src/file/sync-run.ts with structured pull outcomes and cause-preserving errors; refactored SyncHandler.pullChanges onto it without CLI output drift. Added four deterministic unit cases, retained 29/29 cli-sync transcripts, passed typecheck/lint/build/publint; full suite passed 1467/1468 with the sole timeout passing alone in 3.3s.
---
Add packages/tbd/src/file/sync-run.ts. Extract the issues-pull orchestration needed by web from SyncHandler.fullSync behind an OperationLogger-compatible boundary; refactor sync.ts to call it without output/exit/summary drift; add a behavior oracle for success, no-remote, conflict, retry, and failure paths.
