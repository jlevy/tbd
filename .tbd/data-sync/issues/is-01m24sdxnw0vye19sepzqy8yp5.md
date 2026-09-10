---
type: is
id: is-01m24sdxnw0vye19sepzqy8yp5
title: "PR279-R1: Prevent cross-link provider comment transplants"
kind: bug
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels:
  - code-review
  - pr-279
dependencies: []
parent_id: is-01m24sdeqqvssx0yg0zpwe0vvx
created_at: 2026-09-10T04:32:47.290Z
updated_at: 2026-09-10T05:41:46.369Z
closed_at: 2026-09-10T05:41:46.368Z
close_reason: Fixed at c9c651699307817a8d704f7ba15abe8d191047e8; lineage-safe ordinary and approximate-base merge plus wrong-destination outbox regression; disposition https://github.com/jlevy/tbd/pull/279#issuecomment-5613762462
resolution: null
duplicate_of: null
---
Fix packages/tbd/src/file/git.ts so comment recovery is scoped to one provider-link identity in both ordinary namespace merges and the approximate-base preservation postcondition. Same known IDs or two absent IDs may union. Known versus missing or different known IDs must fail closed, retain the resolved namespace, and preserve the complete losing namespace as one deduplicated conflict before any source clearing. Add focused ordinary, approximate-base, and real outbox wrong-destination regressions.
