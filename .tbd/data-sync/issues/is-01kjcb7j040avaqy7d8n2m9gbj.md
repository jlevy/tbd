---
type: is
id: is-01kjcb7j040avaqy7d8n2m9gbj
title: Stabilize flaky full-suite timeouts in doc-add/performance/setup-hooks tests
kind: bug
status: open
priority: 2
version: 14
spec_path: docs/project/specs/active/plan-2026-08-28-sync-convergence-and-stability.md
labels: []
dependencies: []
child_order_hints:
  - is-01m2ypb8srcvvppg79r43d4r4m
  - is-01m2ypbaqtxkwhjf65rt9dyyfb
  - is-01m2ypbbsw06qf1c87sd9w2bfv
  - is-01m2ypbd101ahxa55tyqr1nmdr
created_at: 2026-02-26T06:47:24.929Z
updated_at: 2026-09-20T05:59:14.200Z
extensions:
  linear:
    id: 9e862834-ff88-4557-a9f9-f57c50636776
    linked_at: 2026-09-16T08:25:51.976Z
---

## Notes

PR #316 review on 2026-09-20: default-concurrency local suite on Node 24.19.0 completed in 410.68s: 2684 passed, 14 failed, 1 skipped. Failures included 5s/10s/15s/30s/45s/60s test and hook deadlines across import-short-id-collision, common-dir-layout-doctor, setup-hooks, setup-flows, cli-web, and doc-references; git-remote read average 29.15ms against 10ms; web rendering 1954.64ms against 1000ms. cli-watch returned exit 1 with a 1s watch deadline. cli-web also reported UND_ERR_SOCKET after its timeout. Concurrent unrelated test and filesystem workloads were visible. PR changes only documentation and instruction assertions. Investigate bounded worker concurrency and deterministic timing contracts without weakening behavior assertions. Fresh CI on the corrected PR remains required.
