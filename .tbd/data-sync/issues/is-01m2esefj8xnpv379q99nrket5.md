---
type: is
id: is-01m2esefj8xnpv379q99nrket5
title: "PR #279 comment union rewrites any extensions namespace with a comments array, including third-party data"
kind: bug
status: closed
priority: 1
version: 7
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies:
  - type: blocks
    target: is-01m2erphvafq7s0t4fa4q7enpa
  - type: blocks
    target: is-01m2esegwz6k3bph39z6w4mdat
  - type: blocks
    target: is-01m2eseh97vth3cpm35m074faf
parent_id: is-01m1w3d1e63qg5e2wpz31qkmvn
created_at: 2026-09-14T01:45:29.927Z
updated_at: 2026-09-14T14:10:46.754Z
closed_at: 2026-09-14T14:10:46.753Z
close_reason: |-
  Fixed: the comment union is now gated on shape, not on the key name. New isCommentLog (lib/comment-union.ts) accepts an array only when every entry has comment identity (local_id or id), an 'at' timestamp, and a 'body' — the CommentEntry contract. Both call sites in file/git.ts now require it on BOTH sides before unioning: mergeNamespace (:793) and preserveNamespaceComments (:837). Anything else takes the ordinary LWW path, which preserves the winner verbatim and archives the loser intact.

  Red-green: 5 new cases in tests/merge-namespaces.test.ts ('comment union scoping'). Three failed before the fix — a third-party comments: ['a','b'] came back [], object entries without identity were mangled, and the archived conflict lost_value had comments stripped so even the discarded side was unrecoverable. Two guard cases (a real provider log, and an empty log) passed before and after, so the provider path is unchanged. Original repro from the bead notes re-run against the fix: passes.
resolution: null
duplicate_of: null
---
Introduced by PR #279 (tbd-8rnq). preserveExtensionComments (file/git.ts:856-879 at #283's head) runs after every mergeIssues over every extensions namespace, and for any namespace where both sides are objects and either carries a `comments` array it applies the provider lineage check and unionCommentArrays (lib/comment-union.ts:40-59). That union drops non-object entries (:42), collapses entries with the same identity, and re-sorts (:58). `extensions` is documented as the namespace for third-party data (lib/schemas.ts:79), so a third-party `extensions.<ns>.comments: ["a", "b"]` becomes [] on any structured merge of that bead, silently, and a different-id lineage rule can record a spurious conflict for a namespace that has nothing to do with tracker links. Not present on main (no preserveExtensionComments).

Fix in #279's layer, then rebase #282 and #283: apply the postcondition only to integration provider namespaces, or only when every entry in both arrays is a CommentEntry-shaped object; otherwise keep the ordinary merge result untouched. Red first: a third-party namespace with a string array and with object entries lacking comment identity, merged across a conflicting edit, is unchanged.

## Notes

VERIFIED LIVE ON MAIN 2026-09-14 (52d5c2f7). The bead body's closing line 'Not present on main (no preserveExtensionComments)' is now stale: #279 merged in a3085685, so preserveExtensionComments is on main at file/git.ts:855 and is called at :1193 after every mergeIssues.

Empirical repro (vitest against src, then removed): base/local/remote beads with extensions.myapp = { comments: ['a','b'(,'c')], note: <differing> }. commentsShareLinkLineage returns true because NEITHER side has an 'id' key (git.ts:698-701), so unionCommentArrays runs and filters out every non-object entry (lib/comment-union.ts:42). Result: extensions.myapp.comments === [] . Expected ['a','b','c'].

Impact: silent third-party data loss on any structured bead merge (tbd sync merge, rescue, workspace import) for any extensions namespace that happens to use the key 'comments'. Not present in v0.8.1. This is a REGRESSION SHIPPED TO MAIN, not a pre-merge finding, and it blocks any release cut from current main.
