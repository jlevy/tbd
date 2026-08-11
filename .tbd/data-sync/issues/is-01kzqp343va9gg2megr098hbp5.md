---
type: is
id: is-01kzqp343va9gg2megr098hbp5
title: "Phase 2: lk newest-observation merge rule in file/git.ts"
kind: task
status: closed
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzn2wa8b53y8wjh1gegbzhhx
parent_id: is-01kzn2w85qxpbp8cqtn7mkbvkg
created_at: 2026-08-11T05:52:56.442Z
updated_at: 2026-08-11T06:45:58.235Z
closed_at: 2026-08-11T06:45:58.235Z
close_reason: "Phase 2 implemented in PR #206 (96be7b34..c36dbc70): policy schema and resolution, bridge records with newest-observation merge, pure reconcile matrix, write-ahead intents (OQ7 probed live: comment client UUIDs are exactly-once), the full sync command, append-only comment sequences with union merge, link/unlink/comment with one-source guard and --take stance, doctor config-loss tripwire, sync_on_tbd_sync fold, and end-to-end coverage through the real built binary against the mock. Full suite green in the pre-push hook; live rollout gates before sync_on_tbd_sync tracked in the spec."
---
Extend the merge dispatch in file/git.ts: files under .tbd/data-sync/bridge/*/links/ merge by newest observation — higher remote_updated_at wins, synced_at tie-break, whole-record. Both sides are observations of the same external truth, so this is conflict-free by construction. Multi-machine divergence test: two histories advancing the same link record, merged, newest wins. Also: intents/ files merge by file-add union (unique run ids). See spec 'merged like everything else'.
