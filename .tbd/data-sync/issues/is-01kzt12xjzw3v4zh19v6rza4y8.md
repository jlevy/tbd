---
type: is
id: is-01kzt12xjzw3v4zh19v6rza4y8
title: Keep release transcripts from abandoning active writer locks
kind: bug
status: closed
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - concurrency
  - tests
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T03:43:32.958Z
updated_at: 2026-08-12T04:38:51.142Z
closed_at: 2026-08-12T04:38:51.142Z
close_reason: Implemented and verified against the normative concurrency contract; focused adversarial coverage and the full release matrix pass.
---
The full tryscript gate exposed that mutation commands piped through head can be terminated after the consumer closes while their shared writer transaction is still active. That leaves the crash-recovery lock/active epoch behind, so the next transcript waits for stale recovery and times out. Replace early-closing consumers on shared-data mutators with EOF-reading selectors (for example sed -n), audit the remaining transcript pipelines, and retain the real stale-lock semantics rather than weakening production recovery thresholds.
