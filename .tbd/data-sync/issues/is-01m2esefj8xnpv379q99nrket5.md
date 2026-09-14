---
type: is
id: is-01m2esefj8xnpv379q99nrket5
title: "PR #279 comment union rewrites any extensions namespace with a comments array, including third-party data"
kind: bug
status: open
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies:
  - type: blocks
    target: is-01m2erphvafq7s0t4fa4q7enpa
  - type: blocks
    target: is-01m2esegwz6k3bph39z6w4mdat
parent_id: is-01m1w3d1e63qg5e2wpz31qkmvn
created_at: 2026-09-14T01:45:29.927Z
updated_at: 2026-09-14T01:45:33.947Z
---
Introduced by PR #279 (tbd-8rnq). preserveExtensionComments (file/git.ts:856-879 at #283's head) runs after every mergeIssues over every extensions namespace, and for any namespace where both sides are objects and either carries a `comments` array it applies the provider lineage check and unionCommentArrays (lib/comment-union.ts:40-59). That union drops non-object entries (:42), collapses entries with the same identity, and re-sorts (:58). `extensions` is documented as the namespace for third-party data (lib/schemas.ts:79), so a third-party `extensions.<ns>.comments: ["a", "b"]` becomes [] on any structured merge of that bead, silently, and a different-id lineage rule can record a spurious conflict for a namespace that has nothing to do with tracker links. Not present on main (no preserveExtensionComments).

Fix in #279's layer, then rebase #282 and #283: apply the postcondition only to integration provider namespaces, or only when every entry in both arrays is a CommentEntry-shaped object; otherwise keep the ordinary merge result untouched. Red first: a third-party namespace with a string array and with object entries lacking comment identity, merged across a conflicting edit, is unchanged.
