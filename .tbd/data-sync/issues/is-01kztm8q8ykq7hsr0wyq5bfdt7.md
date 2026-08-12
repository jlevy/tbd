---
type: is
id: is-01kztm8q8ykq7hsr0wyq5bfdt7
title: Harden subprocess test budgets on slow Windows runners
kind: bug
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - pr-207
  - ci
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T09:18:46.045Z
updated_at: 2026-08-12T09:37:29.831Z
closed_at: 2026-08-12T09:37:29.824Z
close_reason: Centralized finite Windows subprocess-test budgets at 60 seconds while retaining every existing non-Windows budget; removed low nested overrides across Git/CLI integration suites, covered web server readiness, and preserved deliberate lock algorithm deadlines. Focused 103-test run, full 113-file/1,568-test coverage run, 1,075 transcripts, formatting, strict lint/typecheck, build, publint, package-age, packed-web proof, and watch-release topology all pass. Hosted Windows verification follows the pushed commit.
---
PR #207 Windows CI reproduced test-timeout failures on two runs, but in four different unrelated subprocess-heavy tests (15s and 30s budgets); 1,444+ tests and all watch/lock concurrency suites pass. Define a centralized platform-aware timeout policy for Git/CLI integration tests, preserve stricter non-Windows budgets, verify focused/full local gates, and require a green Windows hosted run.

## Notes

Implementation map:\n- packages/tbd/tests/test-helpers.ts: add subprocessTestTimeout(nonWindowsMs), returning a finite 60s Windows budget while retaining each existing non-Windows budget.\n- packages/tbd/tests/cli-changes.test.ts and cli-watch.test.ts: replace misleading fixed WINDOWS_CLI_TEST_TIMEOUT_MS values.\n- packages/tbd/tests/cli-web.test.ts: apply the policy to spawned server readiness and all process-heavy acceptance cases.\n- packages/tbd/tests/golden-output.test.ts, spec-inherit.test.ts, specs-flag.test.ts, prime.test.ts, corrupted-data.test.ts, setup-flows.test.ts, and bead-watch.test.ts Git-safety block: replace low overrides that defeat the existing Windows policy.\n- Preserve deliberate algorithmic time bounds such as the 15s stale-lock recovery test; do not serialize workers or relax non-Windows budgets.\nValidation: formatting, lint/typecheck, build, focused tests, full suite, sync/commit/push, then require the Windows GitHub Actions job and all other PR checks to pass.
