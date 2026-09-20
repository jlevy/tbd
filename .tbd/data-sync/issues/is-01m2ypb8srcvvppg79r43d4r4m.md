---
type: is
id: is-01m2ypb8srcvvppg79r43d4r4m
title: Separate wall-clock performance budgets from contended correctness tests
kind: bug
status: open
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-08-28-sync-convergence-and-stability.md
labels: []
dependencies: []
parent_id: is-01kjcb7j040avaqy7d8n2m9gbj
created_at: 2026-09-20T05:59:09.875Z
updated_at: 2026-09-20T06:12:27.545Z
---
PR #316 validation: performance.test.ts web response rendering took 1954.64ms against 1000ms; git-remote.test.ts random reads averaged 29.15ms against 10ms and 5000-row list/filter tests exceeded 5s. Run isolated and under concurrent suites to measure contention. Keep correctness coverage in ordinary CI and place machine-sensitive budgets in a measured benchmark tier or bound worker concurrency. Do not simply widen thresholds. Acceptance: reproducible performance measurements and reliable ordinary suite under documented load.

## Notes

Two completed full-suite runs took 410.68s and 381.55s. In a single-worker diagnostic run, web rendering improved from 1954.64ms to 181.91ms, but a first issue write still measured 447.69ms against 200ms, 100 reads took 788.32ms against 500ms, and 5000-row listing hit 5s. Worker count alone does not eliminate host I/O sensitivity. Preserve correctness checks and use a controlled benchmark budget.
