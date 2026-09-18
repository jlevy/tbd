---
type: is
id: is-01m2rwhckt7yf08njf198xfzcc
title: "PR #309 A5: readEffectiveGrants/prime spawn too many git processes"
kind: bug
status: closed
priority: 3
version: 2
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels: []
dependencies: []
parent_id: is-01m2rw9zzs69gde6ayhc8z6pwt
created_at: 2026-09-17T23:51:55.258Z
updated_at: 2026-09-18T00:53:34.961Z
closed_at: 2026-09-18T00:53:34.961Z
close_reason: "Fixed on claude/pr-review-lifecycle-and-delegation in ab3261a2 (B1 CI identity 8aaf70a8, A8 Windows paths ff7a3b5a). CI run 35292159287 success at ff7a3b5a. Disposition replies not posted: addressing agent has no ManagePullRequest and gh comment returns 403."
resolution: null
duplicate_of: null
---
Severity: Low. PR #309. Review: https://github.com/jlevy/tbd/pull/309#pullrequestreview-5242256965. Files: prime.ts:396-404; policy-grants.ts:745-830. Reading grants spawns ~7 git processes and prime re-reads AGENTS.md. Fix: return committed text from readEffectiveGrants; resolve candidates with one git for-each-ref.
