---
type: is
id: is-01kzvdg5qtx8e95hmd4f2e1p3s
title: Align board-row text baselines and disclosure centerline
kind: bug
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
  - design-system
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T16:39:44.633Z
updated_at: 2026-08-12T17:21:46.030Z
closed_at: 2026-08-12T17:21:46.030Z
close_reason: "Implemented and verified in the shared web design-system pass: source/CSS contract tests 32/32; focused concurrency/UI suite 304/304; full repository gate 113 files and 1,591 tests; CLI transcripts 1,075/1,075; packed web artifact passed; light/dark live-browser geometry, behavior, ordering, copy feedback, and 1,000-row resource bounds validated."
---
Board cells currently top-align mixed 12px/14px typography, leaving Kind and Title baselines below ID, priority, and status. In styles.css, baseline-align text cells, preserve a deliberate caret alignment context, and size/center the shared disclosure control against the canonical board text line box so the chevron optical center—not its tip—aligns with the row center. Cover the CSS contract and verify computed Range geometry in the live browser.
