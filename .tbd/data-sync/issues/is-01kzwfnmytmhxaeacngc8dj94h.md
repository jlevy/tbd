---
type: is
id: is-01kzwfnmytmhxaeacngc8dj94h
title: Make board sort-key selection explicitly exhaustive
kind: task
status: closed
priority: 3
version: 3
labels:
  - web
  - code-quality
  - release-readiness
dependencies: []
parent_id: is-01kzw6y8ppmp6bt6nd8tgmmspn
created_at: 2026-08-13T02:36:55.641Z
updated_at: 2026-08-13T02:43:16.154Z
closed_at: 2026-08-13T02:43:16.154Z
close_reason: "Implemented, documented, code-reviewed, covered by focused and full-suite tests, benchmarked at 10,001 rows, and validated in the rebuilt live browser on PR #209."
---
Review finding R1: add the project-standard never exhaustiveness guard to the BoardSortKey selector so future columns fail at the selector itself when not implemented. Keep malformed external order values bounded and ignored at the query boundary; cover valid displayed keys through behavioral tests.
