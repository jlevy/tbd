---
type: is
id: is-01kzvr0jwhcp4j11v2e7kws9t7
title: Run end-to-end 0.5.0 release validation
kind: task
status: in_progress
priority: 1
version: 3
labels:
  - release
dependencies: []
parent_id: is-01kzvr00wp6yqv6cbhgagx0ve8
created_at: 2026-08-12T19:43:28.143Z
updated_at: 2026-08-12T23:38:23.883Z
---
Run the documented release gates from a clean main-derived branch: review the last-tag diff and dependency delta; audit runtime and dev dependencies; enforce package age; run format, lint, typecheck, build, unit/golden/tryscript coverage, publint, packaged web/watch smoke, install smoke, benchmark, and relevant platform CI; inspect the packed tarball and verify version/changelog/release workflow contracts. Record every failure as a child bead before fixing it.

## Notes

Local release validation for PR #209 is complete: pnpm run ci and the pre-push suite passed 1,602 tests; coverage/tryscript passed 1,075 transcript assertions; release:verify/publint, package-age, packed web proof, built watch smoke, and 5,000-bead benchmark passed. Awaiting hosted PR checks and final install smoke.
