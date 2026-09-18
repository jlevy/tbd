---
type: is
id: is-01m2rwj40xc95hp5gty9qk5431
title: "PR #309 B2: fetch default branch before policy show; print SHA and age"
kind: bug
status: open
priority: 2
version: 1
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels: []
dependencies: []
parent_id: is-01m2rw9zzs69gde6ayhc8z6pwt
created_at: 2026-09-17T23:52:19.229Z
updated_at: 2026-09-17T23:52:19.229Z
---
Severity: Medium. PR #309. Review: https://github.com/jlevy/tbd/pull/309#pullrequestreview-5242339173. Files: agent-policy-grants.md:156-163; review-and-merge-prs.md:77-93,:210-215,:247-251; delegate-to-subagents.md:65-72; policy.ts:169; prime.ts:248. Grants are as of last fetch; tbd sync fetches only the sync branch. Fix: fetch default branch before tbd policy show in workflows; print source SHA and age.
