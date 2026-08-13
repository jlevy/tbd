---
type: is
id: is-01kzw99hbw2k6nj9dgqsd09xq8
title: Clamp collapsed bead summaries to four lines
kind: task
status: closed
priority: 2
version: 3
labels:
  - web
  - release-readiness
dependencies: []
parent_id: is-01kzw6y8ppmp6bt6nd8tgmmspn
created_at: 2026-08-13T00:45:27.290Z
updated_at: 2026-08-13T02:43:16.128Z
closed_at: 2026-08-13T02:43:16.128Z
close_reason: "Implemented, documented, code-reviewed, covered by focused and full-suite tests, benchmarked at 10,001 rows, and validated in the rebuilt live browser on PR #209."
---
Clamp the title/summary text in collapsed bead rows to four lines with a real CSS ellipsis in packages/tbd/src/web/styles.css, while removing the clamp for tr.open so expansion reveals the full title alongside the full Description body. Ensure pretty-tree ancestor lines cover exactly the visible wrapped height in either state. Add CSS contract tests and live-browser checks using a long row.

## Notes

Implementing with the pretty-tree geometry work on PR #209.
