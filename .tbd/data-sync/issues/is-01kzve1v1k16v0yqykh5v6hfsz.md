---
type: is
id: is-01kzve1v1k16v0yqykh5v6hfsz
title: Standardize subtle fast UI transitions
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
created_at: 2026-08-12T16:49:23.506Z
updated_at: 2026-08-12T17:21:46.070Z
closed_at: 2026-08-12T17:21:46.070Z
close_reason: "Implemented and verified in the shared web design-system pass: source/CSS contract tests 32/32; focused concurrency/UI suite 304/304; full repository gate 113 files and 1,591 tests; CLI transcripts 1,075/1,075; packed web artifact passed; light/dark live-browser geometry, behavior, ordering, copy feedback, and 1,000-row resource bounds validated."
---
Review MetaBrowser/kpress motion primitives and audit every interactive state in packages/tbd/src/web/styles.css. Apply one subtle fast UI transition token consistently to hover/focus/open/reveal states (rows, controls, icon/copy buttons, choosers, tags as applicable), with properties scoped to avoid transition: all. Keep observed data motion on its separate --motion-data-* family, honor reduced-motion, document the rule, enforce CSS contracts, and validate visually in light/dark modes.
