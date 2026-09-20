---
type: is
id: is-01m2y5e22fjethpczwr3qvv560
title: "PR #309 K1: Require verified remote default for policy authority"
kind: bug
status: in_progress
priority: 1
version: 2
delegate: fix_309_policy
labels: []
dependencies: []
parent_id: is-01m2y4ygvt317renehn2caprwa
hold: null
hold_until: null
created_at: 2026-09-20T01:03:35.488Z
updated_at: 2026-09-20T01:06:56.006Z
started_at: 2026-09-20T01:06:56.005Z
---
Review K https://github.com/jlevy/tbd/pull/309#issuecomment-5746575183. resolveDefaultBranch trusts nondefault main/init.defaultBranch when remote HEAD is absent or unfetched. Fail closed for all remote-backed clones without verified default tracking ref.
