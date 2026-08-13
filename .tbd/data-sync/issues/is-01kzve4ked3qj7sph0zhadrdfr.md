---
type: is
id: is-01kzve4ked3qj7sph0zhadrdfr
title: Render Pretty as a Boolean checkbox
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
created_at: 2026-08-12T16:50:54.028Z
updated_at: 2026-08-12T17:21:46.076Z
closed_at: 2026-08-12T17:21:46.076Z
close_reason: "Implemented and verified in the shared web design-system pass: source/CSS contract tests 32/32; focused concurrency/UI suite 304/304; full repository gate 113 files and 1,591 tests; CLI transcripts 1,075/1,075; packed web artifact passed; light/dark live-browser geometry, behavior, ordering, copy feedback, and 1,000-row resource bounds validated."
---
Replace the confusing tree toggle button with a checkbox labeled 'pretty', matching the --pretty CLI Boolean and the existing ready checkbox pattern. Change client typing/listeners/state reflection so checked maps directly and bijectively to BoardControls.pretty; keep action controls such as Expand as buttons. Update equivalent command behavior, design-system docs/tests, and validate keyboard/live interaction.
