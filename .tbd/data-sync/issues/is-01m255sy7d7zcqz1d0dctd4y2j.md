---
type: is
id: is-01m255sy7d7zcqz1d0dctd4y2j
title: "PR #283 review FABLE-DOC-01: preserve exact bytes in Git attributes"
kind: bug
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies: []
parent_id: is-01m255rtpd3e4pwb15vcvc8zjz
created_at: 2026-09-10T08:09:03.980Z
updated_at: 2026-09-10T08:09:27.196Z
closed_at: 2026-09-10T08:09:27.195Z
close_reason: Fixed by standalone documentation reconciliation commit 9794b8b0d4fad7d9d42c0e9f61a033d24f30339c and independently re-reviewed at that exact head with no remaining findings.
resolution: null
duplicate_of: null
---
PR #283 landing review found packages/tbd/docs/tbd-design.md normatively recommended blanket LF normalization for .tbd/data-sync/**, conflicting with exact-byte native-comment and quarantine invariants. Scope normalization to canonical issue/metadata surfaces, document that current f08 installs only the mapping merge rule, and assign tested non-transforming comment/evidence attributes to tbd-44kw.

## Notes

FABLE-DOC-01 fixed in 9794b8b0d4fad7d9d42c0e9f61a033d24f30339c. packages/tbd/docs/tbd-design.md now scopes LF normalization to canonical issue/metadata surfaces, states current f08 installs only the mapping merge rule, and assigns tested non-transforming comment/quarantine attributes to tbd-44kw.
