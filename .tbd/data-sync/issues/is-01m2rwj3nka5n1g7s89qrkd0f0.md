---
type: is
id: is-01m2rwj3nka5n1g7s89qrkd0f0
title: "PR #309 B1: do not read grants from HEAD when a remote exists"
kind: bug
status: in_progress
priority: 0
version: 2
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
delegate: unknown@cursor
labels: []
dependencies: []
parent_id: is-01m2rw9zzs69gde6ayhc8z6pwt
hold: null
hold_until: null
created_at: 2026-09-17T23:52:18.866Z
updated_at: 2026-09-17T23:53:35.648Z
started_at: 2026-09-17T23:53:35.648Z
---
Severity: Blocker. PR #309. Review: https://github.com/jlevy/tbd/pull/309#pullrequestreview-5242339173. Files: policy-grants.ts:745-780, :816-825; policy.ts:90-96; doctor.ts:2285; prime.ts:361-365. When no default branch resolves, grants are read from HEAD, so a PR checkout can present its own block as effective. Fix: HEAD fallback only with no remotes; otherwise unresolved (all unanswered) with repair; validate sync.remote against git remote; skip kind=local when a remote exists; prime never prints a non-default-branch source as Effective grants; tests for single-branch clone, CI-style checkout, and sync.remote redirect.
