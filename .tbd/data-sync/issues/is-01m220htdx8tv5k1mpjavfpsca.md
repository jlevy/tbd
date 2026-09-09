---
type: is
id: is-01m220htdx8tv5k1mpjavfpsca
title: Preserve native comments across sync and recovery
kind: epic
status: open
priority: 1
version: 8
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
delegate: codex-native-comment-preservation
labels: []
dependencies:
  - type: blocks
    target: is-01m220j40yd8fcw9n3yf4412dv
  - type: blocks
    target: is-01m22b72fpparmvxhj4q2938n7
parent_id: is-01m1w3g0smx3ezvwz4g8mkmjy9
child_order_hints:
  - is-01m222xy6md5svr7r89cdjkh1g
  - is-01m222ys2fv17vvxnr67rxhwq9
  - is-01m222yt5xq4580v776dnxj8p8
  - is-01m222yv5nn21vthsjnqwg1vc5
created_at: 2026-09-09T02:39:31.770Z
updated_at: 2026-09-09T05:45:53.909Z
---
Phase 2 preservation umbrella. Before any public comment writer exists, deliver an ordered stack covering a shared native-comment inventory and immutable transition engine; guards on every sync-branch commit, merge, fast-forward, and push path; preservation through workspace, outbox, unrelated-history rescue, and repair; then doctor, migration, scaffold, sync-metadata, and packed-client compatibility checks. Keep existing f08 repositories and behavior available throughout.
