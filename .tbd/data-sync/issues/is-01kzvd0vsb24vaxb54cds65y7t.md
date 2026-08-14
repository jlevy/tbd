---
type: is
id: is-01kzvd0vsb24vaxb54cds65y7t
title: Strengthen web detail labels and align repository status baselines
kind: bug
status: closed
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T16:31:22.922Z
updated_at: 2026-08-12T17:21:45.983Z
closed_at: 2026-08-12T17:21:45.983Z
close_reason: "Implemented and verified in the shared web design-system pass: source/CSS contract tests 32/32; focused concurrency/UI suite 304/304; full repository gate 113 files and 1,591 tests; CLI transcripts 1,075/1,075; packed web artifact passed; light/dark live-browser geometry, behavior, ordering, copy feedback, and 1,000-row resource bounds validated."
---
Two related typography defects in packages/tbd/src/web/styles.css: expanded-body .blabel headings such as Description and Notes are undersized and too light, and #statusdl uses floated dt plus offset dd so label/value baselines drift by several pixels. Promote detail labels to a slightly larger medium system weight using shared typography tokens, and render the status definition list as an explicit two-column grid whose dt/dd items align on the text baseline. Keep values monospace and labels sans. Add design-contract coverage in packages/tbd/tests/bead-web-css.test.ts and verify computed baselines in the built light/dark viewer.
