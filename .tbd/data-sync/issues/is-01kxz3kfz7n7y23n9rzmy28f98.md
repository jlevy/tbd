---
type: is
id: is-01kxz3kfz7n7y23n9rzmy28f98
title: "Epic: Linear integration pilot (design rework pending)"
kind: epic
status: closed
priority: 1
version: 18
spec_path: docs/project/specs/active/plan-2026-07-19-bead-watch-and-external-sync.md
labels:
  - linear-sync
dependencies: []
child_order_hints:
  - is-01kxz3kwxeqkvm82y0k4xxs8br
  - is-01kxz3kxh9sbve7xjsghe0cpwj
  - is-01kxz3ky8wndt84qxx67jyrvze
  - is-01kxz3kyvykzh47rrjaqht9rn3
  - is-01kxz3mf4ytsqe23z53h0z8c7q
  - is-01kxz3mfsysxwdhm0yfwg1sfa6
  - is-01kxz3mgdhc9j6ys7brk59z96e
  - is-01kxz3mh21qe9fb5pnnraartv9
  - is-01kzbyhghkgw70wetew3ffy4cn
  - is-01kzbyhsm660v90763b5tr11rk
created_at: 2026-07-20T06:32:21.735Z
updated_at: 2026-08-15T05:33:51.850Z
closed_at: 2026-08-15T05:33:51.849Z
close_reason: "The legacy PR #197 integration design was superseded by the active external-tracker plan and the production implementation merged in PR #206."
extensions:
  linear:
    id: 3a214faa-8f6e-45a6-b511-dfd271c5af42
    key: TBD-80
    url: https://linear.app/finterm-ai/issue/TBD-80/epic-linear-integration-pilot-design-rework-pending
    linked_at: 2026-08-10T19:37:27.989Z
---
Track a provider-isolated Linear experiment built on the independently mergeable PR #205 watch foundation. The provider plan on PR #197 is not current implementation authority: its core config/schema/tbd-sync coupling conflicts with the active Integration Layer rules. No provider code begins until tbd-vm5s produces a new Linear-specific plan. Generic extension merge/write foundations remain separately tracked by tbd-le2l and tbd-z95g. The pilot should begin with one-way import plus status writeback, module-owned state/checkpoints, external-ID bindings, and failure/idempotency tests.

## Notes

Blocked only on design rework tbd-vm5s. Legacy phase beads are deferred as superseded scope, not PR #205 or release blockers.
