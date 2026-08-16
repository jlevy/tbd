---
type: is
id: is-01m00v3wqaatz90kaztwafsz1c
title: Origin and repo labels on mirrored issues; origin-scoped inbound scan
kind: feature
status: open
priority: 1
version: 8
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - phase-3
  - multi-repo
dependencies:
  - type: blocks
    target: is-01m010epmrrmp2s67x1pe8xqa3
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-14T19:13:54.410Z
updated_at: 2026-08-16T19:06:50.331Z
extensions:
  linear:
    id: e703e67f-cae0-4264-94b5-b37fb6047aae
    linked_at: 2026-08-16T00:14:10.412Z
---
PARTIALLY SHIPPED. The label half landed in #222 and was hardened afterwards: every mirrored item carries the tbd:sync origin marker plus repo/<name> in the shared repo group, asserted additively so a human's labels are never removed, and provisioned by `tbd integration setup`.

The origin-scoped INBOUND SCAN did not land. `isForeignRepoLabel` (src/integrations/core/origin-labels.ts) exists, is exported, is documented as the inbound guard — and is called from nowhere. Verified by grep: zero non-definition references in src/.

The consequence is live today: three repositories share team OS, and each one's inbound scan sees the others' issues rather than skipping items carrying a sibling's repo label. Project scoping currently hides this — each repo filters to its own project — so it is latent rather than active. It becomes real the moment two repositories share a project, or inbound mode moves off `report`.

Remaining work: wire isForeignRepoLabel into the inbound candidate filter in sync-engine, and add a test with two repo labels in one scope.
