---
type: is
id: is-01kzvengx0dmgsmmrb9my3gnwy
title: Optimize copy affordances and add copy-complete glyph
kind: task
status: closed
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels: []
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T17:00:08.479Z
updated_at: 2026-08-12T17:21:46.082Z
closed_at: 2026-08-12T17:21:46.082Z
close_reason: "Implemented and verified in the shared web design-system pass: source/CSS contract tests 32/32; focused concurrency/UI suite 304/304; full repository gate 113 files and 1,591 tests; CLI transcripts 1,075/1,075; packed web artifact passed; light/dark live-browser geometry, behavior, ordering, copy feedback, and 1,000-row resource bounds validated."
---
Use a geometry-matched copy-complete icon (rear square plus checked front square), preserve the green hold/fade feedback, and reduce per-literal browser overhead by eliminating inline SVG subtrees and per-button listeners while keeping one accessible keyboard-focusable control per copyable literal.

## Notes

Implemented in packages/tbd/src/web/client.ts copyButton/copyValueFor/finishCopy plus delegated capture click, animationend, pointerover, and focusin handlers; packages/tbd/src/web/styles.css uses geometry-matched copy and checked-copy CSS masks, 1.5s feedback with a 67% green hold, green-only opacity fade, and specificity-safe suppression; packages/tbd/tests/bead-web-css.test.ts pins DOM/listener/mask/timing contracts. Live page: 285 copy targets, 0 inline SVG children, saving 855 elements; three shared listeners replace about 1,140 target listeners. Real clipboard activation produced the checked mask and success green, stayed fully opaque through the hold, faded only in green, ended opacity 0 while hovered, and left open rows at zero.
