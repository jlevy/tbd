---
type: is
id: is-01kzn2wa8b53y8wjh1gegbzhhx
title: "Phase 2: tbd integration sync — the full synchronization command"
kind: task
status: closed
priority: 2
version: 19
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzn510qqbk3ax3pbw447xw8y
  - type: blocks
    target: is-01kzq3fnjg30v06sbhn9h86phz
  - type: blocks
    target: is-01kzqmt5ht0jnw9ypf2shtsk14
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
updated_at: 2026-08-13T20:12:12.852Z
closed_at: 2026-08-11T06:45:58.270Z
close_reason: "Phase 2 implemented in PR #206 (96be7b34..c36dbc70): policy schema and resolution, bridge records with newest-observation merge, pure reconcile matrix, write-ahead intents (OQ7 probed live: comment client UUIDs are exactly-once), the full sync command, append-only comment sequences with union merge, link/unlink/comment with one-source guard and --take stance, doctor config-loss tripwire, sync_on_tbd_sync fold, and end-to-end coverage through the real built binary against the mock. Full suite green in the pre-push hook; live rollout gates before sync_on_tbd_sync tracked in the spec."
extensions:
  linear:
    id: 8675d876-1c1a-4672-a073-5980ff8568dc
    linked_at: 2026-08-10T19:37:36.617Z
    key: TBD-2
    url: https://linear.app/finterm-ai/issue/TBD-2/phase-2-tbd-integration-sync-the-full-synchronization-command
---
cli: tbd integration sync [--dry-run] [--yes] [--json]. Orchestrates the pieces (policy tbd-h09r, bridge tbd-22p3/c907, reconcile tbd-o5v5, intents tbd-vc9e): replay pending intents -> pull linked (derived watermark = max remote_updated_at minus generous overlap; over-fetch is free because base comparison discards no-ops) -> reconcile per field_sync -> apply (external writes with per-pair failure containment, then bead patches via the normal issue write path, then base advance + intent cleanup, committed) -> policy scan (create outbound-new, import or report inbound per mode) -> honest report distinguishing nothing-to-do from did-something. Bulk guard both directions. Correctness never depends on timestamps. See spec section 10.

## Notes

Design finalized in spec bdd7b487, clauses renamed per owner review (outbound/inbound/field_sync; sync = full synchronization). Build order: policy (tbd-h09r) -> bridge-state + lk merge -> reconcile -> intents -> adapter additions -> sync command -> comment sequences (tbd-509s). Open question: does commentCreate honor client UUIDs (spec OQ7) — probe live, encode the answer in the mock.
