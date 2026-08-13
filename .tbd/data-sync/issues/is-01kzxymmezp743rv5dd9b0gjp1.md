---
type: is
id: is-01kzxymmezp743rv5dd9b0gjp1
title: Paginate Linear comment retrieval for long discussions
kind: bug
status: open
priority: 2
version: 1
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - linear
  - integration
  - comments
dependencies: []
parent_id: is-01kzxy6ks7pd36nnzrppfdspq6
created_at: 2026-08-13T16:17:45.438Z
updated_at: 2026-08-13T16:17:45.438Z
---
Linear listComments currently requests only one MAX_PAGE_SIZE page, so discussions beyond 250 comments are incomplete and can miss comments depending on connection ordering. Traverse pageInfo/endCursor and test the boundary without changing persisted comment caps.
