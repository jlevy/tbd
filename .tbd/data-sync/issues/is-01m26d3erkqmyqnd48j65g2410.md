---
type: is
id: is-01m26d3erkqmyqnd48j65g2410
title: Prevent Beads import short-ID collision from overwriting an existing issue
kind: bug
status: open
priority: 0
version: 3
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies:
  - type: blocks
    target: is-01m2eseh97vth3cpm35m074faf
parent_id: is-01m1w3d1e63qg5e2wpz31qkmvn
created_at: 2026-09-10T19:35:50.287Z
updated_at: 2026-09-14T04:31:05.051Z
---
import.ts resolves an incoming Beads short ID to an already-loaded issue before checking mapping occupancy. An unrelated existing issue that owns that display ID can therefore donate its internal ID and have its file overwritten. Detect distinct source identity, allocate a deterministic replacement short ID, preserve both records, and add a destructive-collision regression. Treat as a release safety blocker.

## Notes

Verified still live on main at 52d5c2f7 (2026-09-14 release-readiness pass). cli/commands/import.ts: the existingByShortId lookup at :585 returns an already-loaded issue and donates its internal ID via beadsTotbd BEFORE the collision check at :592 ever runs. existingByShortId is built at :562-564 from every existing issue's short ID, with no check of source identity, so an unrelated pre-existing tbd issue that happens to own short ID N is matched by an incoming Beads bead 'xx-N' and has its file overwritten. Contrast :578, which does match by source identity (existingByBeadsId) and is correct. The collision branch at :592-604 is unreachable for exactly the destructive case it was written to prevent. Now wired as a blocker of the release gate tbd-lz1q.
