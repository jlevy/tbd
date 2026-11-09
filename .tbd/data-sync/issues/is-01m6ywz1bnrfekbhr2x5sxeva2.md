---
type: is
id: is-01m6ywz1bnrfekbhr2x5sxeva2
title: Make the fake Cargo fixture cleanup resilient on Windows
kind: bug
status: open
priority: 3
version: 1
labels: []
dependencies: []
created_at: 2026-11-09T00:57:36.361Z
updated_at: 2026-11-09T00:57:36.361Z
---
In PR #330 before the docs fixes (d4ebfe5e), the Windows CI job reached the assertions but failed afterEach in tests/rust-lint-cost-script.test.ts with EPERM removing the fake-cargo fixture. The same test passed in the concurrent main run. Investigate whether the fixture needs bounded Windows retries around recursive rmSync while retaining failure on persistent errors. Evidence: https://github.com/jlevy/tbd/actions/runs/42540705787/job/128914736680
