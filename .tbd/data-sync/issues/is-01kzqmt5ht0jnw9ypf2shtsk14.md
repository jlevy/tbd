---
type: is
id: is-01kzqmt5ht0jnw9ypf2shtsk14
title: "Phase 2: comment sync — append-only sequences in the link namespace"
kind: task
status: open
priority: 2
version: 1
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies: []
parent_id: is-01kzn2w85qxpbp8cqtn7mkbvkg
created_at: 2026-08-11T05:30:34.425Z
updated_at: 2026-08-11T05:30:34.425Z
---
Comments sync as append-only sequences: immutable ids (provider comment UUID inbound, ulid local_id outbound), stored as allow-listed entries in extensions.<provider>.comments alongside the issue UUID; union-by-id merge (the one array-typed namespace key with union semantics); field_sync.comments: two_way|inbound|outbound|off, default two_way; tbd integration comment <bead> for offline authoring; 10KB/50-comment caps with stub collapse; no edits/deletions (append-only keeps the original). Conflict-report comments ride the same rail. See spec 'Comments: append-only sequences, not merged fields'.
