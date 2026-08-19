---
type: is
id: is-01m044pq2zntk84fyb610dprmn
title: Research and plan docs still describe the pre-f08 'tbd' origin label
kind: chore
status: open
priority: 3
version: 4
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - phase-3
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-16T01:59:11.710Z
updated_at: 2026-08-16T19:28:54.554Z
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
