---
type: is
id: is-01kzqp34vaa03zzhx0xgyj4j58
title: "Phase 2: intents journal + adapter conflict/comment/orphan additions"
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
created_at: 2026-08-11T05:52:57.193Z
updated_at: 2026-08-11T06:45:58.264Z
closed_at: 2026-08-11T06:45:58.264Z
close_reason: "Phase 2 implemented in PR #206 (96be7b34..c36dbc70): policy schema and resolution, bridge records with newest-observation merge, pure reconcile matrix, write-ahead intents (OQ7 probed live: comment client UUIDs are exactly-once), the full sync command, append-only comment sequences with union merge, link/unlink/comment with one-source guard and --take stance, doctor config-loss tripwire, sync_on_tbd_sync fold, and end-to-end coverage through the real built binary against the mock. Full suite green in the pre-push hook; live rollout gates before sync_on_tbd_sync tracked in the spec."
---
integrations/core/intents.ts: per-run intent file under bridge/<p>/intents/<run-id>.yml written+committed before external writes, replayed on start (cross-machine safe), deleted after base advance. Idempotency per op: create duplicate-id-as-success with link recovery; update idempotent; attachment upsert; comment client-UUID dedup if honored (probe live: spec OQ7) else local_id body-marker fallback. linear/adapter.ts additions: postConflict(), commentResolve/Unresolve, archived/deleted detection for orphans, updatedAt-filtered batched fetch, comment list/create. Mock server extended to encode the probed truth.
