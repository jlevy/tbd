---
type: is
id: is-01kzxh4bkrfd346fb6ckcns3nb
title: Stabilize 5,000-bead performance test under transient suite load
kind: bug
status: open
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-08-28-sync-convergence-and-stability.md
labels:
  - performance
  - testing
dependencies: []
created_at: 2026-08-13T12:21:40.599Z
updated_at: 2026-09-16T08:24:08.319Z
extensions:
  linear:
    id: 695ec74d-4cdc-4c25-967e-b8aba6ef922c
    linked_at: 2026-09-16T08:24:08.319Z
---
The pre-push full suite on 2026-08-13 timed out once at 5.315s in git-remote.test.ts while the machine was heavily loaded. The immediately preceding full suite measured 0.854s, the isolated rerun measured 0.883s, and hosted Benchmark passed. Preserve the <5,000ms product threshold; make the harness distinguish real list latency from scheduler/disk contention without weakening the benchmark.
