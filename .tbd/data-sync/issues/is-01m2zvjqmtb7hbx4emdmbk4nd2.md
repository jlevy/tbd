---
type: is
id: is-01m2zvjqmtb7hbx4emdmbk4nd2
title: git-remote.test.ts end-to-end outbox test uses the default 5s timeout and times out under full-suite load
kind: bug
status: open
priority: 3
version: 1
labels: []
dependencies: []
created_at: 2026-09-20T16:49:51.767Z
updated_at: 2026-09-20T16:49:51.767Z
---
packages/tbd/tests/git-remote.test.ts:582 'end-to-end: outbox save after merge only includes substantive changes' runs real git operations with vitest's default 5000ms timeout. Alone it takes 1.4s (2026-09-20, load avg 55). In a full local 'pnpm test' (190 files in parallel, load avg ~80) it timed out at 5000ms while the file took 154s overall; 2981 other tests passed. Present on main (a92ecab9); not touched by PRs #309/#310. It blocked the local pre-push hook for the #309/#310 stack push. Fix: give the test an explicit budget via the repo's subprocess timeout helper (tests/test-helpers.ts subprocessTestTimeout), consistent with the other real-git tests in that file.
