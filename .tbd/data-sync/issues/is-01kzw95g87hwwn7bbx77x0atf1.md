---
type: is
id: is-01kzw95g87hwwn7bbx77x0atf1
title: Apply field/value typography to updated timestamps
kind: task
status: closed
priority: 2
version: 3
labels:
  - web
  - release-readiness
dependencies: []
parent_id: is-01kzw6y8ppmp6bt6nd8tgmmspn
created_at: 2026-08-13T00:43:15.076Z
updated_at: 2026-08-13T02:43:16.122Z
closed_at: 2026-08-13T02:43:16.122Z
close_reason: "Implemented, documented, code-reviewed, covered by focused and full-suite tests, benchmarked at 10,001 rows, and validated in the rebuilt live browser on PR #209."
---
Apply the established field/value typography contract to the Updated column in packages/tbd/src/web/styles.css: the header stays sans chrome while visible relative timestamp values use the mono literal/value face with tabular numerals. Extend design-system comments and CSS contract tests, then validate the column visually in light and dark modes.

## Notes

Implementing with the current PR #209 web design-system pass.
