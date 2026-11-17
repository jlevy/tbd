---
type: is
id: is-01m7khcyghq1as4m5p7z7khfxn
title: "PR #332 D10: Per-decorator option tables in the push detector (command -p, time -p)"
kind: bug
status: in_progress
priority: 3
version: 2
delegate: claude-code@vm
labels: []
dependencies: []
hold: null
hold_until: null
created_at: 2026-11-17T01:19:32.369Z
updated_at: 2026-11-17T01:19:51.135Z
started_at: 2026-11-17T01:19:51.135Z
---
Review D (suggestion). git-push-detector.ts:27-31 treats -p as taking a value for every decorator, right for sudo -p <prompt> and wrong for command -p and time -p, so command -p git push and time -p git push are missed. Review: https://github.com/jlevy/tbd/pull/332#pullrequestreview-5930928560
