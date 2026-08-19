---
type: is
id: is-01kzw93emdr4zjsfatr6t9vp73
title: Add counted dynamic label multi-chooser
kind: feature
status: closed
priority: 1
version: 3
labels:
  - web
  - release-readiness
dependencies: []
parent_id: is-01kzw6y8ppmp6bt6nd8tgmmspn
created_at: 2026-08-13T00:42:07.884Z
updated_at: 2026-08-13T02:43:16.116Z
closed_at: 2026-08-13T02:43:16.116Z
close_reason: "Implemented, documented, code-reviewed, covered by focused and full-suite tests, benchmarked at 10,001 rows, and validated in the rebuilt live browser on PR #209."
---
Replace the free-form Labels filter in packages/tbd/src/web/index.html/client.ts with a dynamic multi-select chooser modeled on MetaBrowser's file-extension chooser. Derive label facets and tallies from the complete unfiltered board data on the server, cap displayed choices at 32 deterministically, preserve selected labels, render labels with existing neutral tag styling, serialize selections to the same CLI-equivalent label semantics, and keep keyboard/accessibility behavior clean. Extend board/core response types, filter/query behavior, design-system CSS comments, and server/client/CSS tests; validate interactively.

## Notes

Implementing on codex/release-readiness-0.5.0 in PR #209; using MetaBrowser's extension-facet chooser as the interaction reference.
