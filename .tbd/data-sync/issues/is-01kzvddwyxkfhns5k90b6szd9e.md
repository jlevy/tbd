---
type: is
id: is-01kzvddwyxkfhns5k90b6szd9e
title: Standardize subtle dark-mode-safe scrollbars
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
created_at: 2026-08-12T16:38:30.108Z
updated_at: 2026-08-12T17:21:46.023Z
closed_at: 2026-08-12T17:21:46.023Z
close_reason: "Implemented and verified in the shared web design-system pass: source/CSS contract tests 32/32; focused concurrency/UI suite 304/304; full repository gate 113 files and 1,591 tests; CLI transcripts 1,075/1,075; packed web artifact passed; light/dark live-browser geometry, behavior, ordering, copy feedback, and 1,000-row resource bounds validated."
---
Review /Users/levy/wrk/github/metabrowser scrollbar styling and adapt the minimal cross-platform pattern to tbd. Apply token-based subtle scrollbars to every scrollable text/data surface, including Latest local changes, event log, code hunks, and horizontal table overflow. Avoid white tracks in dark mode, retain usable hit targets and native fallback, document the component role, and validate light/dark rendering.
