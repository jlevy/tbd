---
type: is
id: is-01kzn50r7paeyyswk6cc8wrjs3
title: "integrations/core/types.ts: TrackerAdapter and canonical types"
kind: task
status: open
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzn50t7fz3vthsw35kkdbx2b
  - type: blocks
    target: is-01kzn50vbgseh54rtpjz6jf2g1
parent_id: is-01kzn2w8x0c038fhk1c859248r
created_at: 2026-08-10T06:16:04.085Z
updated_at: 2026-08-10T06:16:07.279Z
---
Define the provider seam. TrackerAdapter { provider, resolveRef, fetchIssues, applyChanges, upsertAttachments, spliceDescription, postConflict, ensureMeta }. Supporting types: ExternalRef, ExternalIssue, CanonicalPatch, ProviderMeta, AttachmentSpec, ConflictReport, MirrorPlan, MirrorReport. All values tbd-canonical (tbd status enum, P0-P4) so mapping tables live per-provider. Spec Component 11.
