---
type: is
id: is-01m2gca52g359wgy28dmnrf8a2
title: "PR #287 review R6: merge-namespaces guard cases pass against pre-PR code"
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
created_at: 2026-09-14T16:34:25.488Z
updated_at: 2026-09-14T16:40:26.394Z
started_at: 2026-09-14T16:38:47.137Z
closed_at: 2026-09-14T16:40:26.394Z
close_reason: "Fixed rather than dropped. Both cases are now genuinely two-sided: the provider-log case is local [A,C] vs remote [A,B] from base [A] expecting [A,B,C]; the empty-log case has local edit a sibling field while remote appends the first comment. The finding was right that as written they returned at resolveNamespace:757-759 before the gate was reached and so passed against pre-PR code. Kept rather than deleted because the gate's positive path deserves coverage in the file that tests the gate, even though integrations-comments.test.ts:166 also covers it. Added a comment recording why both sides must differ, so the next person does not simplify them back."
resolution: null
duplicate_of: null
---
tests/merge-namespaces.test.ts:248-266. Both 'still unions a real provider comment log' cases are one-side edits: local equals base, so resolveNamespace returns the remote edit at 757-759 before bothSidesAreLogs is evaluated, and the union observed is preserveNamespaceComments re-deriving the same array. They pass on the old code and do not pin the gate's positive path. That path is covered by tests/integrations-comments.test.ts:166, so this is mislabelled redundancy rather than a coverage gap. Fix: make both sides change, or drop the cases.
