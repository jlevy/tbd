---
type: is
id: is-01m1yzxaq89j76rrca4yb48ww2
title: A pulled description containing a '## Notes' heading is truncated on read-back
kind: bug
status: open
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-1
dependencies: []
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-07T22:30:37.026Z
updated_at: 2026-09-07T22:31:40.915Z
---
Found while surveying #265. parseMarkdownWithFrontmatter splits the body at the first /(^|\n)## Notes\n/i (parser.ts:74-83, :130-131). A description pulled from Linear that contains a literal '## Notes' heading is stored verbatim, then truncated on the next read, so local != base and the next run pushes the truncated prose: converges in two runs but loses text. Store pulled prose so a literal '## Notes' round-trips unchanged (escape or fence on write, or split only on the notes tbd itself appends). Test: pull a description with '## Notes' and assert the second run is quiet and the bead text is intact.
