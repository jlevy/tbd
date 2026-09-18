---
type: is
id: is-01m2rwj3nka5n1g7s89qrkd0f0
title: "PR #309 B1: do not read grants from HEAD when a remote exists"
kind: bug
status: closed
priority: 0
version: 3
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
delegate: unknown@cursor
labels: []
dependencies: []
parent_id: is-01m2rw9zzs69gde6ayhc8z6pwt
hold: null
hold_until: null
created_at: 2026-09-17T23:52:18.866Z
updated_at: 2026-09-18T00:53:34.972Z
started_at: 2026-09-17T23:53:35.648Z
closed_at: 2026-09-18T00:53:34.972Z
close_reason: "Fixed on claude/pr-review-lifecycle-and-delegation in ab3261a2 (B1 CI identity 8aaf70a8, A8 Windows paths ff7a3b5a). CI run 35292159287 success at ff7a3b5a. Disposition replies not posted: addressing agent has no ManagePullRequest and gh comment returns 403."
resolution: null
duplicate_of: null
---
Severity: Blocker. PR #309. Review: https://github.com/jlevy/tbd/pull/309#pullrequestreview-5242339173. Files: policy-grants.ts:745-780, :816-825; policy.ts:90-96; doctor.ts:2285; prime.ts:361-365. When no default branch resolves, grants are read from HEAD, so a PR checkout can present its own block as effective. Fix: HEAD fallback only with no remotes; otherwise unresolved (all unanswered) with repair; validate sync.remote against git remote; skip kind=local when a remote exists; prime never prints a non-default-branch source as Effective grants; tests for single-branch clone, CI-style checkout, and sync.remote redirect.
