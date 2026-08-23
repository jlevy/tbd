---
type: is
id: is-01m0r0dby0gca5cvc264s3tmmj
title: Stabilize load-sensitive full-suite timeouts
kind: bug
status: open
priority: 2
version: 1
spec_path: docs/project/reviews/review-2026-08-23-pr258-holistic-engineering-guidelines.md
labels: []
dependencies: []
parent_id: is-01m0qxb2r48hpyfvzbpbcrnh3w
created_at: 2026-08-23T19:08:59.711Z
updated_at: 2026-08-23T19:08:59.711Z
---
A full pnpm run ci completed 2,428/2,430 tests but doc-references exceeded 60s and git-remote large-repository setup exceeded 5s under suite-wide load. The same two files passed 22/22 in isolation; doc references completed in 18.7s and the status filter itself took 13ms after fixture creation. Reproduce under full concurrency, separate fixture/setup timeout accounting from the measured assertion, and retain bounded failure detection rather than globally raising timeouts.
