---
type: is
id: is-01m26chsyep3kwmkmhfaz5yw7p
title: Make tbd sync --force meaningful or remove it
kind: bug
status: open
priority: 2
version: 1
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies: []
parent_id: is-01m1w3d1e63qg5e2wpz31qkmvn
created_at: 2026-09-10T19:26:11.911Z
updated_at: 2026-09-10T19:26:11.911Z
---
The sync command accepts and passes --force but no current execution path reads it, while prior docs described destructive conflict overwrite behavior. Decide the intended safe contract, implement it with tests or remove/deprecate the flag, and keep compatibility guidance explicit.
