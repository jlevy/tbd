---
type: is
id: is-01m044pq2zntk84fyb610dprmn
title: Research and plan docs still describe the pre-f08 'tbd' origin label
kind: chore
status: open
priority: 3
version: 3
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - phase-3
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-16T01:59:11.710Z
updated_at: 2026-08-16T02:11:59.749Z
extensions:
  linear:
    id: b7926236-f57b-426f-9918-4bba91529aca
    linked_at: 2026-08-16T02:11:59.749Z
---
The origin marker is now tbd:sync (ORIGIN_LABEL in src/integrations/core/origin-labels.ts), because Linear enforces label-name uniqueness team-wide and a bare 'tbd' collides with repo/tbd.

In-code references were corrected. These still say 'label is not tbd':
- docs/project/research/current/research-2026-08-14-agent-sync-protocol-and-hooks.md:902 and :1677
- docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md:430

The research brief is a dated record of what was proposed and can arguably stand, but the active plan should describe what shipped. Decide per document.
