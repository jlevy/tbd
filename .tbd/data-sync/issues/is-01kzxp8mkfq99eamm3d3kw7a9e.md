---
type: is
id: is-01kzxp8mkfq99eamm3d3kw7a9e
title: Preserve provider namespace while enriching provisional links
kind: bug
status: closed
priority: 0
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - integration
  - review
dependencies: []
parent_id: is-01kzx848mdfzapsc2ddm6hm0zt
created_at: 2026-08-13T13:51:23.758Z
updated_at: 2026-08-13T14:06:23.794Z
closed_at: 2026-08-13T14:06:23.794Z
close_reason: Fixed with TDD; authoritative spec, design, user docs, and changelog updated; all local release-candidate gates pass.
---
PR #206 thread PRRT_kwDOQ109P86Y9B-O reports that recovered-create enrichment uses writeLink, which replaces extensions.<provider> and can erase comments or future sibling state recorded after the provisional link. Validate namespace ownership and implement a narrowly safe preserving update with TDD.

## Notes

Validated Bugbot's claim with red unit and crash-recovery tests. Fixed writeLink so it replaces only allow-listed link identity fields while preserving comments and future opaque siblings in the provider namespace; stale key/url fields are still removed and new input remains allow-listed. Recovery regression authors a comment after provisional commit, replays create, enriches key/url, and proves the comment is retained and posted. Full gates green.
