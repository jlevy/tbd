---
type: is
id: is-01m1yzxgm4mb8az2mxy9dggpjk
title: "tbd spec status: one row per spec file with lifecycle folder, open/closed beads, epics, unchecked count, state"
kind: feature
status: open
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-2
dependencies:
  - type: blocks
    target: is-01m1yzy2kx8zrv658fwh0g4dqe
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-07T22:30:43.072Z
updated_at: 2026-09-07T22:31:42.452Z
---
GH #271. New command group tbd spec (registered beside doc/ref in cli.ts:126-127). spec status [--json] [--dir] [--folder]: one row per spec file under specs.dir plus one row per path beads reference that is not a file; columns FOLDER, SPEC, OPEN, CLOSED, EPICS, TODO (unchecked '- [ ]' count), STATE (ok, no beads, all closed, on branch X, moved -> path, ambiguous, missing, duplicate name). This is the triage table update-specs-status.md:56-64 tells agents to build by hand. Counts use tbd list --all semantics (closed included).
