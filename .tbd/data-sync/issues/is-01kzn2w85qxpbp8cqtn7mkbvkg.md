---
type: is
id: is-01kzn2w85qxpbp8cqtn7mkbvkg
title: "Epic: External tracker integrations (Linear first, GitHub next)"
kind: epic
status: open
priority: 1
version: 13
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies: []
child_order_hints:
  - is-01kzn2w8hvc83qrgk9h70rf73y
  - is-01kzn2w8x0c038fhk1c859248r
  - is-01kzn2w9gdhb0xt2hztn7v0aha
  - is-01kzn2w9w9gx9j6h3b250jnyzf
  - is-01kzn2wa8b53y8wjh1gegbzhhx
  - is-01kzn2wakpq2963exxqhj8xkdc
  - is-01kzq3fn6v122vfa0nqxca6x4b
  - is-01kzq3fnjg30v06sbhn9h86phz
  - is-01kzqmt5ht0jnw9ypf2shtsk14
created_at: 2026-08-10T05:38:39.414Z
updated_at: 2026-08-11T05:30:34.425Z
extensions:
  linear:
    id: 7202337e-d1ee-4192-bb6c-c6ae42b97469
    key: TBD-3
    url: https://linear.app/finterm-ai/issue/TBD-3/epic-external-tracker-integrations-linear-first-github-next
    linked_at: 2026-08-10T19:34:32.065Z
---

## Notes

Phase 1 shipped and validated live (PR #206): staged rollout 3->13->82, bulk-guard refusal exercised, team move FIN->TBD with 0 creates / 80 updates / all keys refreshed. End-to-end design completed in spec commit bdd7b487: per-integration linking policy (mirror/import/sync clauses, 'default' preset), Phase 2 sync engine fully specified (bridge lk records with newest-observation merge, pure reconcile matrix, write-ahead intents, both-direction bulk guards, allow-listed write surfaces). Phase 2 build order: tbd-h09r -> tbd-mmkd -> tbd-az29, tbd-h3j3 -> tbd-uu08. Rollout gates before sync_on_tbd_sync anywhere are listed in the spec.
