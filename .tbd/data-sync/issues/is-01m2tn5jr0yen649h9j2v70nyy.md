---
type: is
id: is-01m2tn5jr0yen649h9j2v70nyy
title: "Lost update: concurrent tbd policy writes drop a grant"
kind: bug
status: open
priority: 2
version: 1
labels: []
dependencies: []
created_at: 2026-09-18T16:21:37.152Z
updated_at: 2026-09-18T16:21:37.152Z
---
Review G's G6 (https://github.com/jlevy/tbd/pull/309), from code reading, not probed. tbd policy reads AGENTS.md at policy.ts:279 and writes at :318 with nothing held across the window; recordRecommendedGrants in setup.ts has the same shape. Publication is atomic (atomically writeFile), so no torn file, but two concurrent invocations - plausible with the parallel agents the delegation shortcut encourages - silently drop one grant while both report success. Fix: take withSharedDataSyncLock from file/common-dir-layout.ts across the read-compute-write, or re-read before writing and abort with a 'AGENTS.md changed under us' error.
