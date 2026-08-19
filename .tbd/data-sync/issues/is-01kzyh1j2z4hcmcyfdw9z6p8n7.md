---
type: is
id: is-01kzyh1j2z4hcmcyfdw9z6p8n7
title: Retire the legacy HTML-comment managed-block reader
kind: task
status: open
priority: 3
version: 7
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies: []
parent_id: is-01kzn2w85qxpbp8cqtn7mkbvkg
created_at: 2026-08-13T21:39:23.358Z
updated_at: 2026-08-16T00:13:22.539Z
extensions:
  linear:
    id: 9b6f2d66-dcbc-4def-a269-22c60836869b
    linked_at: 2026-08-16T00:13:22.539Z
---
PR #212 made readers dual-format (current plain-text pair plus the legacy HTML-comment pair) with no removal plan, so LEGACY_MANAGED_BLOCK_MARKERS in core/managed-block.ts is load-bearing indefinitely.

The PR reports all 163 currently linked Linear issues already backfilled to the current format, independently audited through GraphQL. After a release or two, drop the legacy branch from locateManagedBlock and delete the constant; keep the malformed/mixed fail-closed behavior.

## Notes

Deferred from PR #212 by design: legacy marker reading must remain through one or two shipped releases. Remove it only after the compatibility window and another linked-issue audit.
