---
type: is
id: is-01kzvme1a7kfgat6pq0dd27p43
title: Give synthetic Git-history integration tests platform-safe timeouts
kind: bug
status: closed
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - ci
  - windows
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T18:40:54.598Z
updated_at: 2026-08-12T18:51:11.082Z
closed_at: 2026-08-12T18:51:11.081Z
close_reason: null
---
Final hosted Windows run 31628330602 exposed packages/tbd/tests/issue-changes.test.ts createChangesReportFromRefs using Vitest's 5-second unit default despite multiple real Git subprocesses. Under parallel Windows load the test timed out and teardown hit EBUSY on the still-live repo. Apply the existing subprocessTestTimeout() policy to this integration describe and verify focused, full local, and hosted Windows gates.
