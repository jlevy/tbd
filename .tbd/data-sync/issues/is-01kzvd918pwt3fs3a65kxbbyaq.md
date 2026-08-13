---
type: is
id: is-01kzvd918pwt3fs3a65kxbbyaq
title: Align header title and tally text on one baseline
kind: task
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
  - design-system
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T16:35:50.677Z
updated_at: 2026-08-12T17:21:46.003Z
closed_at: 2026-08-12T17:21:46.003Z
close_reason: "Implemented and verified in the shared web design-system pass: source/CSS contract tests 32/32; focused concurrency/UI suite 304/304; full repository gate 113 files and 1,591 tests; CLI transcripts 1,075/1,075; packed web artifact passed; light/dark live-browser geometry, behavior, ordering, copy feedback, and 1,000-row resource bounds validated."
---
In packages/tbd/src/web/index.html and styles.css, group the title and aggregate tally as a baseline-aligned identity row while keeping the live viewer note below the title. Remove padding/margin artifacts that cause text baselines to drift. Validate computed text geometry in the live browser and add CSS contract tests.
