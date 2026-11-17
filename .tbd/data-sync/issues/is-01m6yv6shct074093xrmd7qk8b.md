---
type: is
id: is-01m6yv6shct074093xrmd7qk8b
title: "PR #332 A5: push detector misses timeout/nice/xargs/bash -c git push"
kind: feature
status: open
priority: 3
version: 1
labels: []
dependencies: []
parent_id: is-01m6yv6qega7ts908s41sm9pqm
created_at: 2026-11-09T00:26:53.355Z
updated_at: 2026-11-09T00:26:53.355Z
---
Suggestion, not a regression. src/cli/lib/git-push-detector.ts (a faithful port of fsqlite scripts/detect-git-push.mjs) does not recognize timeout 60 git push, nice git push, xargs git push, or bash -c 'git push'. Add per-decorator option handling (nice -n N, timeout with its duration operand and -s/-k values) in both copies together. Review: https://github.com/jlevy/tbd/pull/332#pullrequestreview-5820355604
