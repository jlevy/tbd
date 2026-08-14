---
type: is
id: is-01m00n672drpwsdvm8g8ea4p3k
title: Harden and release repeatable tbd repository upgrades
kind: task
status: in_progress
priority: 1
version: 5
labels: []
dependencies: []
created_at: 2026-08-14T17:30:19.070Z
updated_at: 2026-08-14T19:27:24.332Z
---
Dogfood the published 0.6.1 self-upgrade, preserve the observed repository diff on an evidence branch, then make same-format and format-changing upgrades deterministic, idempotent, tested from packed artifacts, and enforced by CI/release validation for 0.6.2.

## Notes

Evidence branch codex/evidence-v0.6.1-upgrade is pushed at 67490fd6. PR #223 merged at a2653b10 after senior review and complete CI; v0.6.2 was tagged on that exact merge and its release workflow passed audit, publint, packed web QA, and packaged upgrade proofs for 0.6.1/f07, common 0.4.2/f06, and boundary 0.5.0/f06 before publishing npm and the GitHub Release. Public npm latest, integrity, shasum, and SLSA provenance were verified. The exact first-party tarball was globally installed with lifecycle scripts disabled and a 14-day cutoff for third parties; its 79-node graph matched an independent install with zero audit vulnerabilities. Fresh branch codex/post-release-v0.6.2 from origin/main produced only the four generated hook scripts plus the f07 config stamp, reran byte-for-byte idempotently, passed live prime and shell syntax, and passed the full 2,009-test CI gate. Doctor reports every managed surface current; only the intentionally unavailable Linear credential remains.
