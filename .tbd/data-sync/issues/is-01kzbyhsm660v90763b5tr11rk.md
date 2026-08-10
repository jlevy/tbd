---
type: is
id: is-01kzbyhsm660v90763b5tr11rk
title: Generic extensions read/write/display on the CLI
kind: feature
status: open
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-07-19-bead-watch-and-external-sync.md
labels:
  - linear-sync
dependencies: []
parent_id: is-01kxz3kfz7n7y23n9rzmy28f98
created_at: 2026-08-06T16:29:52.646Z
updated_at: 2026-08-10T19:37:32.398Z
extensions:
  linear:
    id: 267d0a07-a3e7-408a-b5ac-feb3711368d3
    key: FIN-86
    url: https://linear.app/finterm-ai/issue/FIN-86/generic-extensions-readwritedisplay-on-the-cli
    linked_at: 2026-08-10T19:37:32.397Z
---
Core enabler for the integration layer: expose the sanctioned extensions namespace on the CLI so integrations and third-party tools can bind metadata to beads with no schema change. Something like: tbd update <id> --set-extension <ns>='<json>' (and a removal form), extensions shown in tbd show and included in show --json. Extensions is already a known schema field (z.record, schemas.ts:76) that round-trips through every existing CLI; today nothing can set or display it (zero references in create/update/show). Pairs with tbd-le2l (deep_merge_by_key per design §3.5) which makes concurrent namespace writes safe.

## Notes

Generic integration-layer enabler under the active plan. It is not required for PR #205 watch merge or release; the Linear pilot should consume it only after tbd-vm5s defines the provider boundary and tbd-le2l makes namespace merges safe.
