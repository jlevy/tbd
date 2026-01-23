---
close_reason: Not a bug - code at line 295 correctly checks blocker status
closed_at: 2026-01-23T10:37:32.798Z
created_at: 2026-01-23T10:36:25.921Z
dependencies: []
id: is-01kfn6tey28s6j93qt98eqmn1q
kind: bug
labels:
  - high-priority
priority: 2
status: closed
title: "prime.ts: blocked issues calculation checks wrong status"
type: is
updated_at: 2026-01-23T10:37:32.799Z
version: 2
---
The getIssueStats function should check if the blocker issue is closed, not the blocked issue.
