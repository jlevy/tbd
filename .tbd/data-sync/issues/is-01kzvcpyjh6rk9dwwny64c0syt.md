---
type: is
id: is-01kzvcpyjh6rk9dwwny64c0syt
title: Use the muted text token for web tree guides
kind: bug
status: closed
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T16:25:58.096Z
updated_at: 2026-08-12T17:21:45.976Z
closed_at: 2026-08-12T17:21:45.976Z
close_reason: "Implemented and verified in the shared web design-system pass: source/CSS contract tests 32/32; focused concurrency/UI suite 304/304; full repository gate 113 files and 1,591 tests; CLI transcripts 1,075/1,075; packed web artifact passed; light/dark live-browser geometry, behavior, ordering, copy feedback, and 1,000-row resource bounds validated."
---
packages/tbd/src/web/styles.css currently colors .guide line-drawing characters with --border, treating structural text as a rule and making the tree too faint. Reuse the existing --muted auxiliary-text token in both themes rather than adding another hue or weight. Add the tree-guide role to the co-located authoritative component/color inventory, enforce it in packages/tbd/tests/bead-web-css.test.ts, and visually verify nested guides remain legible without competing with bead titles.
