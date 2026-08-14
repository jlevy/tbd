---
type: is
id: is-01kztm8q8ykq7hsr0wyq5bfdt7
title: Harden subprocess test budgets on slow Windows runners
kind: bug
status: closed
priority: 1
version: 5
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - pr-207
  - ci
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T09:18:46.045Z
updated_at: 2026-08-12T09:47:14.898Z
closed_at: 2026-08-12T09:47:14.897Z
close_reason: "Implemented the evidence-based integration-test policy: 30-second default for Git/Node subprocess functional tests, 60-second Windows floor, and larger explicit budgets preserved. Actual performance/lock deadlines remain unchanged. The previously failing 40-case setup suite now passes, along with formatting and strict lint/typecheck; the complete pre-push suite will re-run on push."
---
PR #207 Windows CI reproduced test-timeout failures on two runs, but in four different unrelated subprocess-heavy tests (15s and 30s budgets); 1,444+ tests and all watch/lock concurrency suites pass. Define a centralized platform-aware timeout policy for Git/CLI integration tests, preserve stricter non-Windows budgets, verify focused/full local gates, and require a green Windows hosted run.

## Notes

Post-commit gate evidence refined the policy: the macOS pre-push full suite drove setup-flows docs-summary to 18.2s, so a 15s functional integration timeout is also invalid under non-Windows parallel I/O contention. Set the default non-Windows budget to 30s and Windows floor to 60s; explicit larger budgets remain larger. Performance regression thresholds remain unchanged in performance/lock tests.
