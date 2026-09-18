---
type: is
id: is-01m2rwhckt7yf08njf198xfzcc
title: "PR #309 A5: readEffectiveGrants/prime spawn too many git processes"
kind: bug
status: open
priority: 3
version: 1
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels: []
dependencies: []
parent_id: is-01m2rw9zzs69gde6ayhc8z6pwt
created_at: 2026-09-17T23:51:55.258Z
updated_at: 2026-09-17T23:51:55.258Z
---
Severity: Low. PR #309. Review: https://github.com/jlevy/tbd/pull/309#pullrequestreview-5242256965. Files: prime.ts:396-404; policy-grants.ts:745-830. Reading grants spawns ~7 git processes and prime re-reads AGENTS.md. Fix: return committed text from readEffectiveGrants; resolve candidates with one git for-each-ref.
