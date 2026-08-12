---
type: is
id: is-01kzvd1d9tgj7gt932e8wgaf2c
title: Place web viewer guidance and equivalent command with their owning chrome
kind: bug
status: closed
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T16:31:40.857Z
updated_at: 2026-08-12T17:21:45.996Z
closed_at: 2026-08-12T17:21:45.996Z
close_reason: "Implemented and verified in the shared web design-system pass: source/CSS contract tests 32/32; focused concurrency/UI suite 304/304; full repository gate 113 files and 1,591 tests; CLI transcripts 1,075/1,075; packed web artifact passed; light/dark live-browser geometry, behavior, ordering, copy feedback, and 1,000-row resource bounds validated."
---
The read-only guidance and generated equivalent command currently share a gray #cmdbar despite belonging to different parts of the UI. In packages/tbd/src/web/index.html move 'Live read-only viewer. Ask your agent to change beads; updates appear automatically.' directly below the tbd beads title inside the gray header identity group. Wrap the filters and their equivalent-command row in one vertical controls section; remove the command row's gray panel treatment. In packages/tbd/src/web/styles.css keep the guidance at its current subtle size/color, render the literal 'equivalent:' as sans chrome, and reserve monospace for #cmd only. Preserve wrapping and responsive behavior. Add source/CSS regression coverage and verify ownership/alignment at normal and narrow widths.
