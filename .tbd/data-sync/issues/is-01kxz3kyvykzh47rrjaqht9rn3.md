---
type: is
id: is-01kxz3kyvykzh47rrjaqht9rn3
title: "Compatibility gate: version/format bump for new synced fields"
kind: task
status: open
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-07-20-linear-bead-sync-pilot.md
labels:
  - linear-sync
dependencies:
  - type: blocks
    target: is-01kxz3mf4ytsqe23z53h0z8c7q
parent_id: is-01kxz3kfz7n7y23n9rzmy28f98
created_at: 2026-07-20T06:32:36.990Z
updated_at: 2026-07-20T06:33:09.303Z
---
Issue parsing uses Zod strip mode: older CLIs silently DROP unknown frontmatter (linked, last_actor) when rewriting a bead. Before the new fields ship, bump the minimum-version gate via the existing tbd_format mechanism so pre-pilot CLIs refuse to write. Additive fields only — nil data migration. Pilot spec Rollout step 1.
