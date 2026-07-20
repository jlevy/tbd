---
type: is
id: is-01kxz3kxh9sbve7xjsghe0cpwj
title: Add linked field to IssueSchema with merge_by_id (provider,id) rule
kind: task
status: open
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-07-20-linear-bead-sync-pilot.md
labels:
  - linear-sync
dependencies:
  - type: blocks
    target: is-01kxz3mf4ytsqe23z53h0z8c7q
parent_id: is-01kxz3kfz7n7y23n9rzmy28f98
created_at: 2026-07-20T06:32:35.625Z
updated_at: 2026-07-20T06:46:21.053Z
---
Optional top-level linked: [{provider, id (provider UUID, canonical), key, url, linked_at}] per design doc §8.7 and pilot spec Design §1. SINGLE-SOURCE INVARIANT (decided 2026-07-20): at most one linked entry per bead — CLI guard on bridge link, validation warning, and a merge collapse rule (merge_by_id on (provider,id); if union yields >1 entry, newest linked_at wins, loser to attic). Array shape kept for future relaxation. Includes tbd show display, design-doc §2.7/§3.5 updates, golden tests. No sync bookkeeping in the bead (lives in bridge state).
