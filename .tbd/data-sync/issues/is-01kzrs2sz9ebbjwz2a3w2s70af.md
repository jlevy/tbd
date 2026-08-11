---
type: is
id: is-01kzrs2sz9ebbjwz2a3w2s70af
title: "PR #207 review R1: stale bead fetch error overwrites fresh body"
kind: bug
status: open
priority: 2
version: 1
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - pr-207
  - review
  - web
dependencies: []
parent_id: is-01kzrs2jrjg3pzase83ebxdjyg
created_at: 2026-08-11T16:04:26.216Z
updated_at: 2026-08-11T16:04:26.216Z
---
PR #207 unresolved review thread https://github.com/jlevy/tbd/pull/207#discussion_r3755544745 at packages/tbd/scripts/bead-web.html:1021. loadBody discards stale success responses by bodyGeneration but its catch handler does not; a slower pre-wake request that fails after a newer fetch succeeds can overwrite the fresh cache with an error. Add a failing race regression test first, then gate the error path on the captured generation.
