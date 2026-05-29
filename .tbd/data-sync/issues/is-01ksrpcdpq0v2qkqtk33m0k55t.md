---
type: is
id: is-01ksrpcdpq0v2qkqtk33m0k55t
title: "[task] Make stale dist/ surface clearly during test runs"
kind: task
status: open
priority: 3
version: 2
spec_path: tests/qa/release-v0.2.0-upgrade.qa.md
labels:
  - v0.2.0
dependencies:
  - type: blocks
    target: is-01ksrpdkemmkkhh4j6egqyrvsq
parent_id: is-01ksrpb7b8cfwrzzd34ya9874q
created_at: 2026-05-29T01:43:04.662Z
updated_at: 2026-05-29T01:44:12.491Z
---
On 2026-05-28, 22 tests failed mysteriously after pulling main because dist/bin.mjs was stale (May 24 build vs post-PR-#121 source). The tests exec dist/bin.mjs via spawnSync and saw old behavior, so failure messages looked like real regressions.

Pick one:
- A. Add a 'pretest' npm-script that runs 'pnpm build' (simple but slow per run).
- B. Have the test helper that resolves tbdBin compare dist/bin.mjs mtime vs src/ mtime and abort the run with a clear 'dist/ is stale — run pnpm build' message when stale.
- C. At minimum, add an explicit 'pnpm build' step before 'pnpm test' in publishing docs (see also the publishing.md relocation bead).

Recommend B + C: cheap-to-check guard plus an explicit step in publishing docs.

Key files:
- packages/tbd/tests/ (find the tbdBin resolver — likely repeated across setup-flows.test.ts, setup-hooks.test.ts, common-dir-layout-doctor.test.ts; consolidate into a helper)
- packages/tbd/package.json scripts

QA reference: tests/qa/release-v0.2.0-upgrade.qa.md Phase 1 finding.
