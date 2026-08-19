---
type: is
id: is-01kzn2w85qxpbp8cqtn7mkbvkg
title: "Epic: External tracker integrations (Linear first, GitHub next)"
kind: epic
status: open
priority: 1
version: 30
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
assignee: josh
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
  - is-01kzqp33n0yyyzhvzsyzph0d37
  - is-01kzqp343va9gg2megr098hbp5
  - is-01kzqp34fh1dkxz9ryvt88ng6m
  - is-01kzqp34vaa03zzhx0xgyj4j58
  - is-01kzqs9ax4x2jc12zca4j441px
  - is-01kzrthdrgaakga7fj38sry0et
  - is-01kzx848mdfzapsc2ddm6hm0zt
  - is-01kzx8mkeyergsd0hmq8zj1zd7
  - is-01kzxxj27abvbje3nesecgsk3z
  - is-01kzy93y91gssqs5nbv6zga00g
  - is-01kzbyhsm660v90763b5tr11rk
  - is-01kzyh14se51kt9hhs2ar1ehtr
  - is-01kzyh1j2z4hcmcyfdw9z6p8n7
  - is-01kzyh2066kdr5yymjef2k6nsx
  - is-01kzyh140ydwhzr4mt8r84gmgb
created_at: 2026-08-10T05:38:39.414Z
updated_at: 2026-08-19T04:55:15.508Z
extensions:
  linear:
    id: 7202337e-d1ee-4192-bb6c-c6ae42b97469
    key: TBD-3
    url: https://linear.app/finterm-ai/issue/TBD-3/epic-external-tracker-integrations-linear-first-github-next
    linked_at: 2026-08-10T19:34:32.065Z
---

## Notes

Phases 1 AND 2 implemented in PR #206. Phase 1 validated live (staged rollout, team move FIN->TBD). Phase 2 (96be7b34..c36dbc70): linking policy, bridge lk records with newest-observation merge, pure reconcile matrix, write-ahead intents (comment client-UUID idempotency probed live = exactly-once), tbd integration sync/comment/link/unlink, append-only comment sequences, doctor tripwire, sync_on_tbd_sync fold (default off). Verified: 7 engine scenarios + 8 real-binary e2e tests + full suite green. Remaining: Phase 3 GitHub (tbd-1ae2, designed only), live rollout gates before sync_on_tbd_sync (forced conflict on pilot, two-machine soak), tbd-rdsb (P1) still open, tbd-zlej prefix trap.
