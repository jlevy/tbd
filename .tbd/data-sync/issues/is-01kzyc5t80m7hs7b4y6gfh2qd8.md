---
type: is
id: is-01kzyc5t80m7hs7b4y6gfh2qd8
title: Do not exclude already-linked deep beads from outbound synchronization
kind: bug
status: closed
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies: []
parent_id: is-01kzy93y91gssqs5nbv6zga00g
created_at: 2026-08-13T20:14:19.903Z
updated_at: 2026-08-13T20:18:16.246Z
closed_at: 2026-08-13T20:18:16.245Z
close_reason: Fixed in codex/linear-managed-block-markers. Added a failing regression proving already-linked beads beyond max_nesting were skipped by the one-way mirror, limited max_nesting to unlinked creates, and passed the mirror/core/sync-engine suites. Live backfill then updated the 70 previously excluded linked issues with zero failures; an independent Linear GraphQL audit confirmed all 163 linked UUIDs use exactly one current marker pair with no legacy or malformed descriptions.
---
The managed-block backfill independently found 163 linked Linear beads but only 93 were updated; 70 linked descendants were skipped as deeper than max_nesting. The documented contract says max_nesting limits only new outbound creation, while already-linked items retain their hierarchy and must remain synchronizable. Add a regression test, fix planning/selection, rerun the exact linked-bead backfill, and prove all 163 provider descriptions use the current markers.
