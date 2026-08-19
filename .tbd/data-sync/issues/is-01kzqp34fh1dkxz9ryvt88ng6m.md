---
type: is
id: is-01kzqp34fh1dkxz9ryvt88ng6m
title: "Phase 2: reconcile.ts — pure field matrix with ownership and tie-break"
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
created_at: 2026-08-11T05:52:56.816Z
updated_at: 2026-08-11T06:45:58.258Z
closed_at: 2026-08-11T06:45:58.258Z
close_reason: "Phase 2 implemented in PR #206 (96be7b34..c36dbc70): policy schema and resolution, bridge records with newest-observation merge, pure reconcile matrix, write-ahead intents (OQ7 probed live: comment client UUIDs are exactly-once), the full sync command, append-only comment sequences with union merge, link/unlink/comment with one-source guard and --take stance, doctor config-loss tripwire, sync_on_tbd_sync fold, and end-to-end coverage through the real built binary against the mock. Full suite green in the pre-push hook; live rollout gates before sync_on_tbd_sync tracked in the spec."
---
integrations/core/reconcile.ts: reconcile(base, local, remote, fieldRules) -> {beadPatch, externalPatch, conflicts[]}. Full matrix: {unchanged, changed-same, changed-different}^2 per field; merge|local|remote ownership short-circuits (owner flows, opposite-side edit overwritten AND reported); tie_break newest|local|remote for both-sides merge conflicts; description compared via normalized hash with managed-block strip. Property tests over the whole matrix. No I/O, no network. See spec 'The reconcile algorithm'.
