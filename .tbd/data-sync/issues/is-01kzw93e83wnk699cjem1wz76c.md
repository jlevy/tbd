---
type: is
id: is-01kzw93e83wnk699cjem1wz76c
title: Unify wrapped pretty-tree continuation glyph rendering
kind: bug
status: closed
priority: 2
version: 3
labels:
  - web
  - release-readiness
dependencies: []
parent_id: is-01kzw6y8ppmp6bt6nd8tgmmspn
created_at: 2026-08-13T00:42:07.490Z
updated_at: 2026-08-13T02:43:16.106Z
closed_at: 2026-08-13T02:43:16.106Z
close_reason: "Implemented, documented, code-reviewed, covered by focused and full-suite tests, benchmarked at 10,001 rows, and validated in the rebuilt live browser on PR #209."
---
Make wrapped-line ancestor verticals in packages/tbd/src/web/client.ts::renderTreeTitle and packages/tbd/src/web/styles.css use the exact same glyph, color token, font metrics, width, and geometry as verticals on the first line. Remove any alternate CSS-drawn or mismatched continuation representation. Add focused pure/helper and CSS contract regressions, then validate wrapped rows in the live browser.

## Notes

Implementing on codex/release-readiness-0.5.0 in PR #209; using the existing tbd design system for tree geometry.
