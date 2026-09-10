---
type: is
id: is-01m26fmyjapg37veez1g0m2snq
title: Harden Git-orphan initialization test against full-suite load
kind: bug
status: open
priority: 3
version: 1
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies: []
parent_id: is-01m1w3d1e63qg5e2wpz31qkmvn
created_at: 2026-09-10T20:20:20.681Z
updated_at: 2026-09-10T20:20:20.681Z
---
The 2026-09-10 full-suite run completed 2,590 passing tests and one platform skip but tests/git-init-orphan.test.ts timed out at its fixed 5s ceiling while initializing a pre-existing remote sync branch. The whole file passed 6/6 immediately in isolation and the affected case completed in 984ms. Determine whether suite concurrency needs a targeted timeout or resource-isolation adjustment without masking real hangs.
