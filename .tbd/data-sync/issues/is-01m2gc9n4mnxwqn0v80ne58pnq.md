---
type: is
id: is-01m2gc9n4mnxwqn0v80ne58pnq
title: "PR #287 review R3: '?? []' lets comments:null be rewritten to []"
kind: bug
status: closed
priority: 2
version: 3
delegate: claude-code@vm
labels: []
dependencies: []
parent_id: is-01m2gc9377byvp9mbna5c70bvp
hold: null
hold_until: null
created_at: 2026-09-14T16:34:09.172Z
updated_at: 2026-09-14T16:39:55.523Z
started_at: 2026-09-14T16:34:50.339Z
closed_at: 2026-09-14T16:39:55.523Z
close_reason: |-
  Fixed in one change: new commentLogsUnionable(left, right) in lib/comment-union.ts is now the single gate, used verbatim at both file/git.ts sites (resolveNamespace :793 and preserveNamespaceComments :836). The '?? []' idiom is gone, so comments:null no longer masquerades as an empty log, and the two sites can no longer disagree about one namespace. Resolves R8's naming too — the predicate name states the real condition rather than the misleading bothSidesAreLogs.

  Red-green: two new cases in merge-namespaces.test.ts. 'leaves an untouched comments: null namespace exactly as it was' failed with 'expected { comments: [] } to deeply equal { comments: null }' — reproducing the reviewer's probe exactly. 'does not union a null comments key against a real log' failed with 'expected [ {...} ] to be null', confirming the secondary inconsistency where the merge archived the losing comments and the postcondition unioned them back, so the attic recorded a loss that had not happened. Both green after.
resolution: null
duplicate_of: null
---
file/git.ts:840-842. isCommentLog(x.comments ?? []) makes comments:null qualify as an empty log, so preserveNamespaceComments is NOT the same gate as resolveNamespace:793-798 where null disqualifies. Verified by probe: a third-party namespace { myapp: { comments: null } } identical on base/local/remote, untouched by anyone, comes out { myapp: { comments: [] } } and the bead is re-versioned. YAML 'comments:' with no value parses to null, so this is reachable. The pre-PR guard left it alone: this is a NEW instance of the bug class this PR fixes. Fix: one shared predicate used by both sites.
