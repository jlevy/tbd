---
type: is
id: is-01m00n672drpwsdvm8g8ea4p3k
title: Harden and release repeatable tbd repository upgrades
kind: task
status: in_progress
priority: 1
version: 6
labels: []
dependencies: []
created_at: 2026-08-14T17:30:19.070Z
updated_at: 2026-08-14T20:08:22.398Z
---
Dogfood the published v0.6.2 repository upgrade, preserve its exact generated diff, then remove release literals from generated launchers and release v0.6.3 with one centralized, format-aware fallback and packed upgrade coverage for 0.6.2, 0.4.2, and 0.5.0.

## Notes

Evidence branch codex/evidence-v0.6.1-upgrade is pushed at 67490fd6. PR #223 merged at a2653b10 after senior review and complete CI; v0.6.2 was tagged on that exact merge and its release workflow passed audit, publint, packed web QA, and packaged upgrade proofs for 0.6.1/f07, common 0.4.2/f06, and boundary 0.5.0/f06 before publishing npm and the GitHub Release. Public npm latest, integrity, shasum, and SLSA provenance were verified. The exact first-party tarball was globally installed with lifecycle scripts disabled and a 14-day cutoff for third parties; its 79-node graph matched an independent install with zero audit vulnerabilities. Fresh branch codex/post-release-v0.6.2 and draft PR #225 preserved the rejected exact-version script churn as evidence and will be superseded. On fresh origin/main branch codex/format-compatible-hooks-v0.6.3, generated Bash launchers now probe tbd_format compatibility and read one strictly validated tbd_fallback_version from config only when needed; no launcher embeds a release literal. The current-repo upgrade changed exactly four launchers, two generated skill mirrors, and config, and identical reruns have the same binary diff hash. Final local gates: formatting, typecheck, lint, build, 2,012 tests, publint, runtime audit, 14-day package-age check, packed web proof, watch smoke, release metadata, and packed upgrade proofs from 0.6.2/f07, 0.4.2/f06, and 0.5.0/f06 all pass. Pending: PR review/CI, merge, main-SHA CI gate, v0.6.3 tag/release verification, published self-upgrade, PR #225 closure, and cleanup.
