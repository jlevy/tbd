---
type: is
id: is-01kzwfnmysbzgmvne4sk4tm2py
title: Clarify AND semantics in the label multi-chooser
kind: bug
status: closed
priority: 2
version: 3
labels:
  - web
  - accessibility
  - release-readiness
dependencies: []
parent_id: is-01kzw6y8ppmp6bt6nd8tgmmspn
created_at: 2026-08-13T02:36:55.640Z
updated_at: 2026-08-13T02:43:16.148Z
closed_at: 2026-08-13T02:43:16.148Z
close_reason: "Implemented, documented, code-reviewed, covered by focused and full-suite tests, benchmarked at 10,001 rows, and validated in the rebuilt live browser on PR #209."
---
Review finding R3: repeatable tbd --label filters are ANDed, while a generic multi-chooser may be read as OR. State the all-selected requirement in the trigger/menu accessible names and help text without adding noisy visible chrome; pin it in the co-located design-system comment and static contract tests.
