---
type: is
id: is-01kzvr00wp6yqv6cbhgagx0ve8
title: Prepare get-tbd 0.5.0 release readiness
kind: epic
status: closed
priority: 1
version: 10
labels:
  - release
dependencies: []
child_order_hints:
  - is-01kzq7dqydwdtjncfp9ya5dyjc
  - is-01kzvqvbm2twj1rqff8h9hwp8v
  - is-01kzvr0jwhcp4j11v2e7kws9t7
  - is-01kzvrj7jmbtbxdjjatz2hegt7
  - is-01kzvrve6thxf2fxbs7tyd3jsp
  - is-01kzw5q9x7mkxm6ejw59aj5ay3
created_at: 2026-08-12T19:43:09.717Z
updated_at: 2026-08-12T23:58:50.204Z
closed_at: 2026-08-12T23:58:50.204Z
close_reason: "PR #209 is release-ready: the Windows CRLF regression is fixed, local and hosted suites are green on all platforms, packaging/install smoke passed, all review threads are resolved, and the reviewed package is installed globally. The js-yaml version follow-up remains separately deferred and non-blocking because its parser path is unreachable."
---
Audit current main end to end for the next minor release after the watch, changes, and web features landed. Track and resolve release blockers across runtime security, build/package integrity, tests and CI, upgrade behavior, documentation/release notes, and packaged smoke validation. This epic prepares fixes only; the eventual version-bump/tag release remains a separate deliberate release operation.

## Notes

Release-readiness fixes are published in PR #209. Security scope is documented there and in the changelog/design guideline. Local gates are green; hosted CI and final global-install smoke remain before closing the epic.
