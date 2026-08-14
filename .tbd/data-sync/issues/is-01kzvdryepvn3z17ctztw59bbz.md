---
type: is
id: is-01kzvdryepvn3z17ctztw59bbz
title: Collapse viewer typography to one compact size
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
created_at: 2026-08-12T16:44:32.085Z
updated_at: 2026-08-12T17:21:46.044Z
closed_at: 2026-08-12T17:21:46.044Z
close_reason: "Implemented and verified in the shared web design-system pass: source/CSS contract tests 32/32; focused concurrency/UI suite 304/304; full repository gate 113 files and 1,591 tests; CLI transcripts 1,075/1,075; packed web artifact passed; light/dark live-browser geometry, behavior, ordering, copy feedback, and 1,000-row resource bounds validated."
---
Replace the ad-hoc 10/11/11.5/12/13px typography ladder in packages/tbd/src/web/styles.css with an authoritative scale: 14px body/content, one 12px compact size for all chrome and dense metadata, and 15px only for the page title. Ensure equivalent-command chrome and live-viewer guidance use the legible compact size. Keep medium/strong weight roles independent of size, document the scale, enforce it with CSS contract tests, and validate live rendering.
