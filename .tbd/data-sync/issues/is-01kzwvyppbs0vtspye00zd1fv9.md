---
type: is
id: is-01kzwvyppbs0vtspye00zd1fv9
title: "PR #209 review S13: Make yml alias regression engine-discriminating"
kind: task
status: closed
priority: 2
version: 3
labels:
  - review
  - testing
dependencies: []
parent_id: is-01kzwv4rgyczfrw9dbxfw9f7x2
created_at: 2026-08-13T06:11:35.242Z
updated_at: 2026-08-13T06:29:35.758Z
closed_at: 2026-08-13T06:29:35.758Z
close_reason: "Fixed with regression coverage in the PR #209 senior-review remediation; focused tests and the full 1,630-test release suite pass."
---
PR #209 senior review S13. packages/tbd/tests/gray-matter.test.ts tests bare/yaml/yml with title: Safe, which does not prove yml reaches the custom yaml engine. Use a date or YAML-version-discriminating scalar and assert its string type/value.
