---
type: is
id: is-01kzwvyjj53xz4mw9t0cfdkppb
title: "PR #209 review S3: Make labels beyond top 32 filterable"
kind: bug
status: closed
priority: 1
version: 3
labels:
  - review
  - web
dependencies: []
parent_id: is-01kzwv4rgyczfrw9dbxfw9f7x2
created_at: 2026-08-13T06:11:31.012Z
updated_at: 2026-08-13T06:29:35.720Z
closed_at: 2026-08-13T06:29:35.720Z
close_reason: "Fixed with regression coverage in the PR #209 senior-review remediation; focused tests and the full 1,630-test release suite pass."
---
PR #209 senior review S3. packages/tbd/src/cli/web/board.ts buildLabelFacets caps discovery at MAX_LABEL_FACETS=32, while packages/tbd/src/web/client.ts offers no text escape hatch. Add accessible type-to-filter discovery over the full server facet set or an equivalent escape hatch without breaking conjunctive counts.
