---
type: is
id: is-01m255sz6p9rwwf3bhb5v9zrgr
title: "PR #283 review FABLE-DOC-04: state provider comment caps exactly"
kind: bug
status: closed
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies: []
parent_id: is-01m255rtpd3e4pwb15vcvc8zjz
created_at: 2026-09-10T08:09:04.981Z
updated_at: 2026-09-10T08:09:28.811Z
closed_at: 2026-09-10T08:09:28.811Z
close_reason: Fixed by standalone documentation reconciliation commit 9794b8b0d4fad7d9d42c0e9f61a033d24f30339c and independently re-reviewed at that exact head with no remaining findings.
resolution: null
duplicate_of: null
---
PR #283 final-head review found inconsistent cap wording in the external-tracker plan, September coordination research, packages/tbd/docs/tbd-design.md, and packages/tbd/docs/tbd-docs.md. State the implementation exactly: provider-ID bodies over 10,000 JavaScript UTF-16 code units retain the first 10,000 plus a marker; only the newest 50 provider-ID entries retain a body, possibly truncated; older provider-ID entries retain all identity/metadata with body empty; local_id-only pending entries remain outside both limits until provider identity lands.

## Notes

FABLE-DOC-04 fixed in 9794b8b0d4fad7d9d42c0e9f61a033d24f30339c. All four affected docs now state provider-ID truncation, newest-50 body retention, older-entry metadata retention with empty body, and local_id-only exclusion exactly.
