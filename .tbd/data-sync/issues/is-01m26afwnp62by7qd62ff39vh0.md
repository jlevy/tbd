---
type: is
id: is-01m26afwnp62by7qd62ff39vh0
title: Make fixed-commit readiness reports deterministic
kind: bug
status: open
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies: []
parent_id: is-01m1w3d1e63qg5e2wpz31qkmvn
created_at: 2026-09-10T18:50:12.021Z
updated_at: 2026-09-10T19:17:15.925Z
---
tbd changes/watch evaluate deferred_until against Date.now() while reading fixed commit snapshots, so identical since/tip commits can yield different --ready edges and reports do not record the evaluation instant. Pin a deterministic evaluation time in the report contract or persist the evaluated instant, then add regression coverage for identical commit inputs across wall-clock changes.
