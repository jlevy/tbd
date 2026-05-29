---
type: is
id: is-01ksrpd50dfwh6y3449a864dmq
title: "[bug] tbd doctor exits 0 on hard ✗ findings (future-format layout, missing/invalid config)"
kind: bug
status: closed
priority: 3
version: 4
spec_path: tests/qa/release-v0.2.0-upgrade.qa.md
labels:
  - v0.2.0
dependencies:
  - type: blocks
    target: is-01ksrpdkemmkkhh4j6egqyrvsq
parent_id: is-01ksrpb7b8cfwrzzd34ya9874q
created_at: 2026-05-29T01:43:28.524Z
updated_at: 2026-05-29T02:05:38.566Z
closed_at: 2026-05-29T02:05:38.565Z
close_reason: doctor sets process.exitCode = 1 when any check has status === 'error'. ⚠ warnings still exit 0. Tests updated for future-format layout, future-format config, mismatched layout, and invalid issue files.
---
Doctor reports '✗ Common-dir layout - requires newer tbd (found f05)' and v0.1.30 reports '✗ Config file - Invalid config file' — both with exit 0. CI/scripts cannot gate on doctor's exit code today.

Define categories explicitly:
- ✗ findings (hard errors, including all 'requires newer tbd' surfaces) → exit 1.
- ⚠ findings (recoverable, e.g., 'temp file orphan', 'remote branch not pushed') → exit 0.

The format-versioning guideline already names these as 'fail closed' surfaces; doctor's exit code should match.

Key files:
- packages/tbd/src/cli/commands/doctor.ts (final exit decision)
- packages/tbd/src/cli/commands/checks/* (category for each check)
Tests:
- packages/tbd/tests/common-dir-layout-doctor.test.ts (assert exit 1 on future-format)
- New: assertion that ⚠-only output still exits 0.

QA reference: tests/qa/release-v0.2.0-upgrade.qa.md §2.F.2 and §2.E findings.
