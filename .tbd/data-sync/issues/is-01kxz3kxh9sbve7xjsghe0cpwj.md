---
type: is
id: is-01kxz3kxh9sbve7xjsghe0cpwj
title: Add linked field to IssueSchema with merge_by_id (provider,id) rule
kind: task
status: closed
priority: 1
version: 6
spec_path: docs/project/specs/active/plan-2026-07-19-bead-watch-and-external-sync.md
labels:
  - linear-sync
dependencies:
  - type: blocks
    target: is-01kxz3mf4ytsqe23z53h0z8c7q
parent_id: is-01kxz3kfz7n7y23n9rzmy28f98
created_at: 2026-07-20T06:32:35.625Z
updated_at: 2026-08-15T05:33:51.868Z
closed_at: 2026-08-15T05:33:51.868Z
close_reason: "The legacy PR #197 integration design was superseded by the active external-tracker plan and the production implementation merged in PR #206."
---
Optional top-level linked: [{provider, id (provider UUID, canonical), key, url, linked_at}] per design doc §8.7 and pilot spec Design §1. SINGLE-SOURCE INVARIANT (decided 2026-07-20): at most one linked entry per bead — CLI guard on bridge link, validation warning, and a merge collapse rule (merge_by_id on (provider,id); if union yields >1 entry, newest linked_at wins, loser to attic). Array shape kept for future relaxation. Includes tbd show display, design-doc §2.7/§3.5 updates, golden tests. No sync bookkeeping in the bead (lives in bridge state).

## Notes

Deferred legacy scope from PR #197. Do not add first-class linked/actor schema fields or a tbd_format gate for the experiment. The active Integration Layer requires extension-backed bindings and module-owned state; tbd-vm5s will close or re-scope this bead if post-pilot evidence later justifies promotion. Not a PR #205 or release blocker.
