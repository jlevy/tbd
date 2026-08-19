---
type: is
id: is-01kzvdd4maa35vapp0dwed7hzd
title: Apply table semantic colors to filter choosers
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
created_at: 2026-08-12T16:38:05.193Z
updated_at: 2026-08-12T17:21:46.016Z
closed_at: 2026-08-12T17:21:46.016Z
close_reason: "Implemented and verified in the shared web design-system pass: source/CSS contract tests 32/32; focused concurrency/UI suite 304/304; full repository gate 113 files and 1,591 tests; CLI transcripts 1,075/1,075; packed web artifact passed; light/dark live-browser geometry, behavior, ordering, copy feedback, and 1,000-row resource bounds validated."
---
Use the same authoritative status, priority, and kind presentation roles in the native filter selects as in table cells. Status options and the selected value must use canonical lifecycle symbols/colors; priority must share P0/P1 semantic colors; type must match the muted Kind treatment. Preserve native chooser behavior and cross-platform fallback, document the role, and add contract plus live-browser tests.
