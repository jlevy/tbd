---
type: is
id: is-01kfn6tey28s6j93qt98eqmn1q
title: "prime.ts: blocked issues calculation checks wrong status"
kind: bug
status: closed
priority: 2
version: 7
labels:
  - high-priority
dependencies: []
created_at: 2026-01-23T10:36:25.921Z
updated_at: 2026-03-09T16:12:32.514Z
closed_at: 2026-01-23T10:37:32.798Z
close_reason: Not a bug - code at line 295 correctly checks blocker status
---
The getIssueStats function should check if the blocker issue is closed, not the blocked issue.
