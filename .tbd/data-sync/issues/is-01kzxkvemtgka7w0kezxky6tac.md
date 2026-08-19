---
type: is
id: is-01kzxkvemtgka7w0kezxky6tac
title: Apply the standard Windows subprocess budget to slow acceptance paths
kind: bug
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - ci
  - windows
dependencies: []
parent_id: is-01kzx848mdfzapsc2ddm6hm0zt
created_at: 2026-08-13T13:09:14.517Z
updated_at: 2026-08-13T13:11:04.548Z
closed_at: 2026-08-13T13:11:04.547Z
close_reason: Slow Windows functional acceptance paths now consistently use the established platform-aware subprocess budget.
---
PR #206 hosted Windows CI run 31702271557 completed the relevant work but timed out two subprocess/git-heavy acceptance paths under full parallel load: cli-web shared-lock proof at ~53s due to fixed 45s override, and doctor managed-surfaces setup due to the global 30s hook budget. Reuse the established subprocessTestTimeout helper consistently for per-test and setup/cleanup budgets, retain strict performance assertions, validate focused and full suites, and document the CI disposition.

## Notes

Validated from hosted Windows run 31702271557: cli-web shared-lock acceptance finished around 53s against a fixed 45s test budget, while doctor managed-surfaces setup exceeded the global 30s hook budget under full parallel process/I/O load. Reused the established subprocessTestTimeout helper for the cli-web suite/SSE wait and the doctor setup/cleanup hooks, yielding the standard 60s Windows floor while retaining 45s elsewhere and leaving strict performance assertions unchanged. Focused 13-test cross-surface suite passes.
