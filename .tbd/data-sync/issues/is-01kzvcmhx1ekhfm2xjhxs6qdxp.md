---
type: is
id: is-01kzvcmhx1ekhfm2xjhxs6qdxp
title: Expand web beads when any point on the row is clicked
kind: bug
status: closed
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T16:24:39.584Z
updated_at: 2026-08-12T17:21:45.958Z
closed_at: 2026-08-12T17:21:45.958Z
close_reason: "Implemented and verified in the shared web design-system pass: source/CSS contract tests 32/32; focused concurrency/UI suite 304/304; full repository gate 113 files and 1,591 tests; CLI transcripts 1,075/1,075; packed web artifact passed; light/dark live-browser geometry, behavior, ordering, copy feedback, and 1,000-row resource bounds validated."
---
The board advertises row activation with a pointer cursor, but packages/tbd/src/web/client.ts renderRow() attaches toggle behavior only to the small disclosure button. Make the table row the single click owner so clicking any visible cell expands/collapses the bead, while disclosure button mouse and keyboard clicks bubble through exactly once rather than double-toggling. Keep body rows and pager rows non-toggleable. Add source-level regression coverage in packages/tbd/tests/bead-web-css.test.ts and verify row, chevron-button, Enter/Space, and repeated toggle behavior in the built browser.
