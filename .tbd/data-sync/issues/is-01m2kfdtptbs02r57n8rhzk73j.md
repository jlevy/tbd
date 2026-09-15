---
type: is
id: is-01m2kfdtptbs02r57n8rhzk73j
title: Uncontested relink records a spurious provider-namespace conflict and attic entry
kind: bug
status: open
priority: 2
version: 1
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies: []
parent_id: is-01m1w3d1e63qg5e2wpz31qkmvn
created_at: 2026-09-15T21:26:34.969Z
updated_at: 2026-09-15T21:26:34.969Z
---
Follow-up from the independent re-review of PR #279's lineage rule (tbd-cskr) on main @ 1238038e. Traced by reading, not reproduced.

Scenario: clone A relinks bead X from provider issue X1 to Y1; clone B edits only the title; the old namespace carries comments. The extensions loop takes the relinked value, then `preserveNamespaceComments` (file/git.ts ~:883-890) sees different lineages and records the X1 namespace as lost. The sync prints "1 conflict resolved, archived in the attic" and writes an attic entry although nothing conflicted.

integrations-comments.test.ts ~:273-291 asserts this outcome for the base-equals-local case, and the real merge-base path runs the same code. Once `issues/.gitattributes` (`merge=binary`) reaches existing repos, more merges take this path and the noise grows.

Fix: record the losing namespace only when both sides changed it relative to the merge base, or when the loser holds undelivered pending comments the winner lacks; update the test to assert no conflict for an uncontested relink.
