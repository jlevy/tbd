---
type: is
id: is-01m044pq2zntk84fyb610dprmn
title: Research and plan docs still describe the pre-f08 'tbd' origin label
kind: chore
status: closed
priority: 3
version: 5
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - phase-3
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-16T01:59:11.710Z
updated_at: 2026-09-06T17:41:39.393Z
closed_at: 2026-09-06T17:41:39.392Z
close_reason: Resolved in pushed b6ad8d68. Active traceability plan now describes bare tbd plus flat repo:<name>, explicit labels.repo collision overrides, current config enums, and the still-open inbound guard. Dated sync/hooks research retains its historical proposal with prominent current-label and missing-guard corrections. TODO stale-label item removed.
resolution: null
duplicate_of: null
extensions:
  linear:
    id: b7926236-f57b-426f-9918-4bba91529aca
    linked_at: 2026-08-16T02:11:59.749Z
---
Research and active-plan docs describe the pre-f08 label scheme. The shipped shape is a bare 'tbd' origin marker plus flat 'repo:<name>' repository labels — no label group.

Stale references remain in:
- docs/project/research/current/research-2026-08-14-agent-sync-protocol-and-hooks.md:902 and :1677
- docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md:430

In-code references and packages/tbd/docs/references/linear-integration-design.md are current. The research brief is a dated record of what was proposed and can arguably stand as-is; the active plan should describe what shipped. Decide per document.
