---
type: is
id: is-01kzq3fnjg30v06sbhn9h86phz
title: "Phase 2: status drift/importable/conflict reporting and sync_on_tbd_sync fold"
kind: task
status: closed
priority: 2
version: 4
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies: []
parent_id: is-01kzn2w85qxpbp8cqtn7mkbvkg
created_at: 2026-08-11T00:27:44.591Z
updated_at: 2026-08-11T06:45:58.286Z
closed_at: 2026-08-11T06:45:58.286Z
close_reason: "Phase 2 implemented in PR #206 (96be7b34..c36dbc70): policy schema and resolution, bridge records with newest-observation merge, pure reconcile matrix, write-ahead intents (OQ7 probed live: comment client UUIDs are exactly-once), the full sync command, append-only comment sequences with union merge, link/unlink/comment with one-source guard and --take stance, doctor config-loss tripwire, sync_on_tbd_sync fold, and end-to-end coverage through the real built binary against the mock. Full suite green in the pre-push hook; live rollout gates before sync_on_tbd_sync tracked in the spec."
extensions:
  linear:
    id: a56d3f3a-e2c8-4522-9cf3-e17f5352935a
    linked_at: 2026-08-11T00:30:16.107Z
    key: TBD-86
    url: https://linear.app/finterm-ai/issue/TBD-86/phase-2-status-driftimportableconflict-reporting-and-sync-on-tbd-sync
---
status gains linked / pending-outbound / importable / drifted / conflicted / orphaned counts and unresolved conflict comments; --offline degrades to base-vs-local drift only. Fold integration sync into plain 'tbd sync' behind sync_on_tbd_sync (default off): runs after git phases, degraded external state never blocks or corrupts git sync. Gated on the Phase 2 rollout gates in the spec (forced conflict exercised, two-machine sync, tbd-rdsb resolved).

## Notes

Also include the config-loss tripwire in the doctor additions: warn when beads carry extensions.<provider> links but no matching integration is configured. The integrations config block has been silently stripped twice now by older-CLI config rewrites (bca0cbcd and eb10de86); the loss is silent at loss time and only loud at use time.
