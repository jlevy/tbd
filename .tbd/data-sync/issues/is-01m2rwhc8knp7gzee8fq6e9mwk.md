---
type: is
id: is-01m2rwhc8knp7gzee8fq6e9mwk
title: "PR #309 A4: withPolicyBlockLf TypeError when tbd markers share a line"
kind: bug
status: open
priority: 3
version: 1
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels: []
dependencies: []
parent_id: is-01m2rw9zzs69gde6ayhc8z6pwt
created_at: 2026-09-17T23:51:54.899Z
updated_at: 2026-09-17T23:51:54.899Z
---
Severity: Low. PR #309. Review: https://github.com/jlevy/tbd/pull/309#pullrequestreview-5242256965. File: packages/tbd/src/lib/policy-grants.ts:582-586. begin and end markers on one line drop the END marker and throw TypeError. Fix: throw PolicyBlockError when beginLineEnd > integration.endMarker.
