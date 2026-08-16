---
type: is
id: is-01kzwncnacxdgc25p0e4ycrhf8
title: Render every Pretty child with one indented elbow
kind: bug
status: closed
priority: 1
version: 2
labels:
  - web
  - release-readiness
dependencies: []
parent_id: is-01kzw6y8ppmp6bt6nd8tgmmspn
created_at: 2026-08-13T04:16:52.555Z
updated_at: 2026-08-13T05:15:38.849Z
closed_at: 2026-08-13T05:15:38.848Z
close_reason: "Implemented a depth-only browser prefix grammar: every non-root row renders spaces plus exactly one U+2514 elbow, with no tee or vertical-bar variants. Documented, covered by a three-level/multi-sibling regression test, live-browser audited across 113 prefixes, and passed all 1,627 tests."
---
In the browser Pretty table, every non-root bead must render exactly one U+2514 elbow prefix at its depth indentation. Never render ancestor vertical bars or tee shapes, including double-nested and deeper rows. Preserve hierarchy through indentation, update the authoritative CSS/design documentation, add regression coverage, rebuild, and validate in the live browser.
