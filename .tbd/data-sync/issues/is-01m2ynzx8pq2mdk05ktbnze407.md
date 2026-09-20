---
type: is
id: is-01m2ynzx8pq2mdk05ktbnze407
title: "PR #309 L2: reject policy grants inside raw HTML"
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
created_at: 2026-09-20T05:52:57.615Z
updated_at: 2026-09-20T05:53:34.361Z
started_at: 2026-09-20T05:53:34.342Z
---
High. Review L https://github.com/jlevy/tbd/pull/309#issuecomment-5747970168. policy-grants.ts:524 ignores raw HTML contexts; pre/script/style/textarea grant blocks parse as authority. Reuse Markdown lexer and fail closed.
