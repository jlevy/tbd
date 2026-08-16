---
type: is
id: is-01kzxk660qk999gpapm6j74rgg
title: Remove fixed-port collision from web server fallback test
kind: bug
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - ci
  - web
dependencies: []
parent_id: is-01kzx848mdfzapsc2ddm6hm0zt
created_at: 2026-08-13T12:57:37.558Z
updated_at: 2026-08-13T13:11:03.970Z
closed_at: 2026-08-13T13:11:03.968Z
close_reason: Deterministic bind fault-injection replaces the fixed adjacent-port race; full parallel suite passes locally.
---
PR #206 hosted Ubuntu CI run 31702271557 failed in tests/web-server.test.ts because the bounded fallback test hard-codes ports 34601-34602 and both were occupied by another parallel test/process. Make the proof allocate an isolated consecutive loopback range dynamically while preserving the contract that default-port startup searches its bounded range and explicit-port startup never moves. Reproduce, validate across repeated/parallel runs, and update the PR CI disposition.

## Notes

Validated from hosted Ubuntu run 31702271557: the test reserved one ephemeral port and guessed its adjacent port was free, allowing unrelated parallel processes to cause EADDRINUSE. Fixed by injecting the socket binder into startWebServer dependencies; production defaults to the real listenOnce implementation, while the test deterministically faults the first candidate and records the second without owning fixed ports. Targeted web-server test, full 1,925-test suite, typecheck, lint, build, package proof, and native-watch QA pass.
