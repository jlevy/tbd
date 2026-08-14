---
type: is
id: is-01kzvbjadd348ch672sr9zfwrr
title: Center a standard chevron in web bead disclosure controls
kind: bug
status: closed
priority: 2
version: 5
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T16:05:57.804Z
updated_at: 2026-08-12T17:21:45.937Z
closed_at: 2026-08-12T17:21:45.936Z
close_reason: "Implemented and verified in the shared web design-system pass: source/CSS contract tests 32/32; focused concurrency/UI suite 304/304; full repository gate 113 files and 1,591 tests; CLI transcripts 1,075/1,075; packed web artifact passed; light/dark live-browser geometry, behavior, ordering, copy feedback, and 1,000-row resource bounds validated."
---
User-observed design-system defect in the live viewer. packages/tbd/src/web/client.ts renderRow() must use the shared CSS chevron primitive with orientation derived from aria-expanded. packages/tbd/src/web/index.html must wrap Status, Type, Priority, and Sort selects so dropdown arrows use the same mark rather than a platform-native thin, edge-crowded arrow. packages/tbd/src/web/styles.css must define one shared geometry, give row disclosure a stable first-line box and true centering, and reserve comfortable trailing select padding. Use MetaBrowser's 12px Lucide chevron as the optical reference: its 24px viewBox and 2–2.5 stroke render near a 1–1.25px effective line, so tbd's smaller CSS mark must not retain a visually heavy 2px border. Extend packages/tbd/tests/bead-web-css.test.ts to pin shared geometry, chooser padding, semantic state, and removal of Unicode disclosure triangles. Verify collapsed, expanded, chooser, and text-weight balance in the built browser at normal scale.
