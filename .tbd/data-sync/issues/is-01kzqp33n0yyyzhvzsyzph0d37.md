---
type: is
id: is-01kzqp33n0yyyzhvzsyzph0d37
title: "Phase 2: bridge-state.ts — lk link records, reverse index, description hashing"
kind: task
status: closed
priority: 2
version: 4
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzqp343va9gg2megr098hbp5
  - type: blocks
    target: is-01kzqp34vaa03zzhx0xgyj4j58
parent_id: is-01kzn2w85qxpbp8cqtn7mkbvkg
created_at: 2026-08-11T05:52:55.967Z
updated_at: 2026-08-11T06:45:58.201Z
closed_at: 2026-08-11T06:45:58.201Z
close_reason: "Phase 2 implemented in PR #206 (96be7b34..c36dbc70): policy schema and resolution, bridge records with newest-observation merge, pure reconcile matrix, write-ahead intents (OQ7 probed live: comment client UUIDs are exactly-once), the full sync command, append-only comment sequences with union merge, link/unlink/comment with one-source guard and --take stance, doctor config-loss tripwire, sync_on_tbd_sync fold, and end-to-end coverage through the real built binary against the mock. Full suite green in the pre-push hook; live rollout gates before sync_on_tbd_sync tracked in the spec."
---
integrations/core/bridge-state.ts: LinkRecordSchema (type lk: bead_id, external_id, base scalars + description_hash, remote_updated_at, synced_at, state linked|orphaned); read/write on bridge/<provider>/links/<bead-id>.yml in the sync worktree; byExternalId reverse index; normalized description hashing (strip managed block, normalize line endings/trailing whitespace, sha256). Pure record logic separate from fs I/O for testability. See spec 'Bridge state: one record per link'.
