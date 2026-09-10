---
type: is
id: is-01m26d3erkqmyqnd48j65g2410
title: Prevent Beads import short-ID collision from overwriting an existing issue
kind: bug
status: open
priority: 0
version: 1
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies: []
parent_id: is-01m1w3d1e63qg5e2wpz31qkmvn
created_at: 2026-09-10T19:35:50.287Z
updated_at: 2026-09-10T19:35:50.287Z
---
import.ts resolves an incoming Beads short ID to an already-loaded issue before checking mapping occupancy. An unrelated existing issue that owns that display ID can therefore donate its internal ID and have its file overwritten. Detect distinct source identity, allocate a deterministic replacement short ID, preserve both records, and add a destructive-collision regression. Treat as a release safety blocker.
