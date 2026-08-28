---
type: is
id: is-01kytgsy0fm7e06v9pt0bdx6db
title: "Flaky tryscript: cli-edge-cases 'Non-existent short ID' collides with did-you-mean suggestions"
kind: bug
status: open
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-28-sync-convergence-and-stability.md
labels:
  - review
dependencies: []
created_at: 2026-07-30T22:02:33.871Z
updated_at: 2026-08-28T19:56:05.440Z
---
The 'Non-existent short ID' case in tests/cli-edge-cases.tryscript.md asserts the exact output 'Error: Issue not found: zzzz'. Since the near-miss ID suggestions feature (PR #198), a randomly generated fixture display ID can land within the suggestion edit-distance of 'zzzz' (observed: test-z95z), adding a 'Did you mean: ...' line that breaks the exact-output assertion. Bit main CI on the v0.4.2 release merge commit d893da28 (run 30584689316, Coverage & Lint, 2026-07-30); passed on rerun with fresh random IDs, and the same tree had passed on the PR run. Fix options: (a) use a probe ID that cannot be near any generated ID (longer or disjoint charset, e.g. 'qqqqqqqq'), (b) pin the fixture IDs the tryscript creates, or (c) relax the assertion to tolerate an optional suggestion line.

## Notes

PR #209 senior review suggestion SG5 notes that the current test replacement changed coverage: retain a short unprefixed missing-ID case alongside the stable distant prefixed probe when this existing flaky-test bead is addressed.
