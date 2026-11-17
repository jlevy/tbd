---
type: is
id: is-01m7khcwzjy7yjakees4mqptjf
title: "PR #332 D1: Push detector misses a push after an unterminated-looking quote (heredoc, $'...', comment)"
kind: bug
status: in_progress
priority: 2
version: 2
delegate: claude-code@vm
labels: []
dependencies: []
hold: null
hold_until: null
created_at: 2026-11-17T01:19:30.802Z
updated_at: 2026-11-17T01:19:49.859Z
started_at: 2026-11-17T01:19:49.859Z
---
Review D (Medium). packages/tbd/src/cli/lib/git-push-detector.ts:38-71 tracks quotes but not heredocs, $(...), $'...', or comments; a quote char inside them inverts quote state and hides a later git push. Fix: tokenizer reports an unterminated quote and the detector falls back to a conservative text test. Review: https://github.com/jlevy/tbd/pull/332#pullrequestreview-5930928560
