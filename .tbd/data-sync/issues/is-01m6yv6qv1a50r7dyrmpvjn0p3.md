---
type: is
id: is-01m6yv6qv1a50r7dyrmpvjn0p3
title: "PR #332 A1: equivalent-spelling recognition ignores matcher and type"
kind: bug
status: closed
priority: 2
version: 2
labels: []
dependencies: []
parent_id: is-01m6yv6qega7ts908s41sm9pqm
created_at: 2026-11-09T00:26:51.617Z
updated_at: 2026-11-09T00:41:14.732Z
closed_at: 2026-11-09T00:41:14.732Z
close_reason: "Fixed in 842ef29e on PR #332; disposition reply posted"
resolution: null
duplicate_of: null
---
Medium. setup.ts mergeClaudeTbdHookEvent and classifyCodexHooks keep an equivalent closing spelling under matcher Edit or type prompt, so the reminder never fires on Bash. Review: https://github.com/jlevy/tbd/pull/332#pullrequestreview-5820355604
