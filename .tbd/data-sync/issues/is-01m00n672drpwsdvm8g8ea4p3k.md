---
type: is
id: is-01m00n672drpwsdvm8g8ea4p3k
title: Harden and release repeatable tbd repository upgrades
kind: task
status: in_progress
priority: 1
version: 4
labels: []
dependencies: []
created_at: 2026-08-14T17:30:19.070Z
updated_at: 2026-08-14T18:27:11.777Z
---
Dogfood the published 0.6.1 self-upgrade, preserve the observed repository diff on an evidence branch, then make same-format and format-changing upgrades deterministic, idempotent, tested from packed artifacts, and enforced by CI/release validation for 0.6.2.

## Notes

Evidence branch codex/evidence-v0.6.1-upgrade is pushed at 67490fd6. Fresh implementation branch codex/streamline-upgrades-v0.6.2 adds stale-CLI fallback selection, exact current-hook preservation, in-process setup follow-up commands, explicit version/commit output, and packed upgrade proofs for 0.6.1/f07, the common 0.4.2/f06 path, and the immediate 0.5.0/f06 boundary. Senior review found and fixed documentation scope, untracked-file/idempotence coverage, stale spec language, release-note clarity, and SemVer build-metadata handling. Full CI passes 2,009 tests; audit, 14-day third-party age gate, publint, packed web QA, all upgrade scenarios, and release metadata are green.
