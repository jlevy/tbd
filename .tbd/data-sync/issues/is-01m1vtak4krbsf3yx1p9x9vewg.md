---
type: is
id: is-01m1vtak4krbsf3yx1p9x9vewg
title: Reuse Linear comment delivery identity across independently syncing replicas
kind: bug
status: open
priority: 1
version: 1
labels: []
dependencies: []
created_at: 2026-09-06T16:55:16.882Z
updated_at: 2026-09-06T16:55:16.882Z
---
Verified with runSync, real LinearAdapter/LinearClient, and existing local LinearMockServer: two independent stores receive the same linked bead and pending local_id; each starts with its own empty journal/data directory. Sync A then stale B: each pushes one comment, provider stores identical text under distinct UUIDs. A repeat of updated B pushes zero. No live provider was used. sync-engine.ts:1247 mints randomUUID per run, so intent replay dedup does not cover shared native identity across stores. Persist or derive a destination-scoped delivery key; cover lost responses, stale replicas, relink lineage, and recovered mappings. Extend closed tbd-5p9k rather than assume its same-journal test proves cross-replica dedup. Research: docs/project/research/current/research-2026-09-06-bead-agent-coordination.md.
