---
type: is
id: is-01m2ypbbsw06qf1c87sd9w2bfv
title: Bound setup and documentation test work under concurrent execution
kind: bug
status: open
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-28-sync-convergence-and-stability.md
labels: []
dependencies: []
parent_id: is-01kjcb7j040avaqy7d8n2m9gbj
created_at: 2026-09-20T05:59:12.955Z
updated_at: 2026-09-20T06:01:38.746Z
---
PR #316 local full suite exceeded setup-hooks 15s deadlines (idempotency, dry-run, script refresh and executable permissions), setup-flows 30s, common-dir-layout-doctor beforeEach 10s, doc-references 60s, and import-short-id-collision 5s. Record isolated versus concurrent timings, reduce repeated process/setup work or configure bounded test concurrency, and retain all behavioral assertions. Acceptance: full suite finishes reliably under a documented worker budget; any timeout adjustment has measured justification.

## Notes

Second local full suite through pre-push: 2689 passed, 9 failed, 1 skipped in 381.55s. Also hit golden-output.test.ts fresh-clone doctor remote issue-count scenario at its 30s deadline. Setup-hooks failures moved between cases, and doc-references again exceeded 60s. All non-test pre-push gates passed. Focused single-worker diagnostic rerun pending.
