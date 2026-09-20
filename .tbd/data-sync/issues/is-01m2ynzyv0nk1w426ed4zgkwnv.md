---
type: is
id: is-01m2ynzyv0nk1w426ed4zgkwnv
title: "PR #309 L3: refresh the trusted policy ref at every gate"
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
created_at: 2026-09-20T05:52:59.231Z
updated_at: 2026-09-20T05:53:35.472Z
started_at: 2026-09-20T05:53:35.462Z
---
High. Review L https://github.com/jlevy/tbd/pull/309#issuecomment-5747970168. review-and-merge-prs.md:249 and delegate-to-subagents.md:73 fetch to FETCH_HEAD under narrow remote map, leaving stale consent. Use explicit destination refspec and regress real Git case.
