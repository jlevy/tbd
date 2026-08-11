---
type: is
id: is-01kzn2wa8b53y8wjh1gegbzhhx
title: "Phase 2: sync engine — bridge records, reconcile matrix, intents, tbd integration sync"
kind: task
status: open
priority: 2
version: 14
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzn510qqbk3ax3pbw447xw8y
  - type: blocks
    target: is-01kzq3fnjg30v06sbhn9h86phz
parent_id: is-01kzn2w85qxpbp8cqtn7mkbvkg
child_order_hints:
  - is-01kzn5121n6gc6xk9w710631cf
  - is-01kzn512cr6x4z2bb5yns27mn0
  - is-01kzn512qgfk7bt4grjfwcsab9
  - is-01kzn5132f7f1gntqbg68wg2hv
  - is-01kzn513dx5caz86bq89cm502s
  - is-01kzn513t5rt6bak750hcvzeta
  - is-01kzn5147yrf3sw28jc7n600r7
created_at: 2026-08-10T05:38:41.547Z
updated_at: 2026-08-11T00:31:49.011Z
extensions:
  linear:
    id: 8675d876-1c1a-4672-a073-5980ff8568dc
    linked_at: 2026-08-10T19:37:36.617Z
    key: TBD-2
    url: https://linear.app/finterm-ai/issue/TBD-2/phase-2-sync-engine-bridge-records-reconcile-matrix-intents-tbd
---
The Phase 2 core, per the rewritten spec design (section 10): core/bridge-state.ts (per-link lk records under bridge/<p>/links/, reverse index, normalized description hashing); the lk newest-observation merge rule in file/git.ts (multi-machine convergence); core/reconcile.ts (pure field matrix, merge/local/remote ownership, tie_break, managed-block-stripped description compare); core/intents.ts (write-ahead journal, cross-machine replay, per-op idempotency table); adapter postConflict + commentResolve lifecycle + updatedAt-filtered batched fetch; and the sync command itself: replay -> pull (derived watermark) -> reconcile -> apply (external, beads via normal write path, base advance + intent cleanup, committed) -> policy scan -> honest report. Correctness never depends on timestamps: updatedAt is only a fetch prefilter; echo suppression falls out of base comparison. Base advances only after work is recorded (tbd-rdsb lesson). Bulk guard in both directions.

## Notes

Design finalized in spec bdd7b487. Build order: policy (tbd-h09r) -> bridge-state + lk merge -> reconcile -> intents -> adapter additions -> sync command. Open question: does commentCreate honor client UUIDs (spec OQ7) — probe live, encode the answer in the mock.
