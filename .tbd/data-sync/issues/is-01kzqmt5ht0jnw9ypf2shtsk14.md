---
type: is
id: is-01kzqmt5ht0jnw9ypf2shtsk14
title: "Phase 2: comment sync — append-only sequences in the link namespace"
kind: task
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies: []
parent_id: is-01kzn2w85qxpbp8cqtn7mkbvkg
created_at: 2026-08-11T05:30:34.425Z
updated_at: 2026-08-11T06:45:58.275Z
closed_at: 2026-08-11T06:45:58.275Z
close_reason: "Phase 2 implemented in PR #206 (96be7b34..c36dbc70): policy schema and resolution, bridge records with newest-observation merge, pure reconcile matrix, write-ahead intents (OQ7 probed live: comment client UUIDs are exactly-once), the full sync command, append-only comment sequences with union merge, link/unlink/comment with one-source guard and --take stance, doctor config-loss tripwire, sync_on_tbd_sync fold, and end-to-end coverage through the real built binary against the mock. Full suite green in the pre-push hook; live rollout gates before sync_on_tbd_sync tracked in the spec."
---
Comments sync as append-only sequences: immutable ids (provider comment UUID inbound, ulid local_id outbound), stored as allow-listed entries in extensions.<provider>.comments alongside the issue UUID; union-by-id merge (the one array-typed namespace key with union semantics); field_sync.comments: two_way|inbound|outbound|off, default two_way; tbd integration comment <bead> for offline authoring; 10KB/50-comment caps with stub collapse; no edits/deletions (append-only keeps the original). Conflict-report comments ride the same rail. See spec 'Comments: append-only sequences, not merged fields'.
