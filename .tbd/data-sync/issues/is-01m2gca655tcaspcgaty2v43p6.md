---
type: is
id: is-01m2gca655tcaspcgaty2v43p6
title: "PR #287 review R8: bothSidesAreLogs is misnamed"
kind: task
status: closed
priority: 3
version: 3
delegate: claude-code@vm
labels: []
dependencies: []
parent_id: is-01m2gc9377byvp9mbna5c70bvp
hold: null
hold_until: null
created_at: 2026-09-14T16:34:26.597Z
updated_at: 2026-09-14T16:39:55.530Z
started_at: 2026-09-14T16:34:50.753Z
closed_at: 2026-09-14T16:39:55.530Z
close_reason: |-
  Fixed in one change: new commentLogsUnionable(left, right) in lib/comment-union.ts is now the single gate, used verbatim at both file/git.ts sites (resolveNamespace :793 and preserveNamespaceComments :836). The '?? []' idiom is gone, so comments:null no longer masquerades as an empty log, and the two sites can no longer disagree about one namespace. Resolves R8's naming too — the predicate name states the real condition rather than the misleading bothSidesAreLogs.

  Red-green: two new cases in merge-namespaces.test.ts. 'leaves an untouched comments: null namespace exactly as it was' failed with 'expected { comments: [] } to deeply equal { comments: null }' — reproducing the reviewer's probe exactly. 'does not union a null comments key against a real log' failed with 'expected [ {...} ] to be null', confirming the secondary inconsistency where the merge archived the losing comments and the postcondition unioned them back, so the attic recorded a loss that had not happened. Both green after.
resolution: null
duplicate_of: null
---
file/git.ts:795. bothSidesAreLogs is true when one side is a log and the other has no comments key at all, so the name overstates the condition. Folding it into the shared predicate from R3 resolves this.
