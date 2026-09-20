---
type: is
id: is-01m2ynzv6kheqfg5hmcd7hemrs
title: "PR #309 L1: refuse tier-agent symlink escapes"
kind: bug
status: in_progress
priority: 1
version: 2
delegate: codex@spud10
labels: []
dependencies: []
parent_id: is-01m2ynnnzw1d0kxwm0s4qvdevf
hold: null
hold_until: null
created_at: 2026-09-20T05:52:55.502Z
updated_at: 2026-09-20T05:53:33.143Z
started_at: 2026-09-20T05:53:33.142Z
---
High. Review L https://github.com/jlevy/tbd/pull/309#issuecomment-5747970168. setup.ts:1015,1047 and uninstall.ts:271 follow tier parent/leaf symlinks outside project. Validate project-relative paths before inspection/mutation and prove external bytes survive.
