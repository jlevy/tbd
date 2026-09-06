---
type: is
id: is-01m1vtafa87ktgfm55m897yhfy
title: Preserve independent pending comments through workspace and outbox recovery
kind: bug
status: open
priority: 1
version: 1
labels: []
dependencies: []
created_at: 2026-09-06T16:55:12.967Z
updated_at: 2026-09-06T16:55:12.967Z
---
The 2026-09-06 coordination review reproduced pending-comment loss through production saveToWorkspace and importFromWorkspace APIs. Seed a shared base comment, then older version-2 [base,A] and newer version-2 [base,B] with distinct local IDs and ordered updated_at. Saving newer into older workspace and importing older outbox into newer data both retain only [base,B], report zero conflicts and empty attic. Direct outbox import clears the source containing A. Automatic sync has different clearing timing but shares the merge path. file/workspace.ts:345/471 treats an older current snapshot as the ancestor, bypassing union. Fix without regressing sequential field updates; cover independent comments, both time orders/equal time, save/import/outbox and archived lost values. Related historical closed tbd-p1lz/tbd-hg05. Research: docs/project/research/current/research-2026-09-06-bead-agent-coordination.md.
