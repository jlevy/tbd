---
type: is
id: is-01kzvcny0tgwnqjqsgs2hfbd87
title: Align wrapped web bead titles after their tree guides
kind: bug
status: closed
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T16:25:24.761Z
updated_at: 2026-08-12T17:21:45.968Z
closed_at: 2026-08-12T17:21:45.968Z
close_reason: "Implemented and verified in the shared web design-system pass: source/CSS contract tests 32/32; focused concurrency/UI suite 304/304; full repository gate 113 files and 1,591 tests; CLI transcripts 1,075/1,075; packed web artifact passed; light/dark live-browser geometry, behavior, ordering, copy feedback, and 1,000-row resource bounds validated."
---
In packages/tbd/src/web/client.ts renderRow(), the tree guide prefix and title currently share one inline text flow, so narrow-screen continuation lines wrap back under the line-drawing glyphs. Render a title-content wrapper with a non-shrinking .guide sibling and a min-width-zero .title-text wrapper. In packages/tbd/src/web/styles.css define the hanging-indent layout so every wrapped title line begins on the same content edge immediately after its tree prefix, while root rows without a prefix retain the existing edge. Add source/CSS regression coverage in packages/tbd/tests/bead-web-css.test.ts and verify nested multi-line rows at the live viewer width.
