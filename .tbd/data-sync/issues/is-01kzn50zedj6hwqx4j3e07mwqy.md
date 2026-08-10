---
type: is
id: is-01kzn50zedj6hwqx4j3e07mwqy
title: "integrations/core/mirror.ts: planMirror (pure) and applyMirror"
kind: task
status: closed
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzn50zw89y02g85dccqy48d8
  - type: blocks
    target: is-01kzn510a0s6yafgt5j1x9nyss
parent_id: is-01kzn2w9w9gx9j6h3b250jnyzf
created_at: 2026-08-10T06:16:11.469Z
updated_at: 2026-08-10T17:35:53.921Z
closed_at: 2026-08-10T17:35:53.921Z
close_reason: Implemented in claude/linear-integration (c23d14d7, 3f1354e9, eb2c5bcf). Verified by 1561 vitest tests and a live check against the Linear API.
---
planMirror(beads, state, meta): MirrorPlan is PURE (creates, updates, attachment upserts, block splices, skips) so --dry-run is the same code path minus writes. applyMirror(plan, adapter): MirrorReport. Per-bead order: upsert issue (create with client UUID, treating the duplicate-id INPUT_ERROR/400 as SUCCESS since issueCreate is not idempotent; then issueUpdate) -> upsert attachments -> splice managed block -> record external id into linked and bridge state. Parents mirror before children so parentId resolves. Mirror depth capped at max_nesting (default 2) because Linear views flatten past ~2 levels even though its data model nests arbitrarily. Spec Component 9.
