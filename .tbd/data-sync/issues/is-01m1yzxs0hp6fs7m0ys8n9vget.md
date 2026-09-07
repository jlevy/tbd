---
type: is
id: is-01m1yzxs0hp6fs7m0ys8n9vget
title: "Bulk update accepts --parent and --spec: set-wide cycle check, lib/child-order.ts with old-parent hint removal, generated eligibility list"
kind: feature
status: open
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-3
dependencies:
  - type: blocks
    target: is-01m1yzxjanhry6w9ns0dpppq6h
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-07T22:30:51.660Z
updated_at: 2026-09-07T22:31:44.258Z
---
GH #269 part 1. runBulk (update.ts:313-349) refuses --parent and --spec as per-ID flags; both take one value applied to every ID, like --priority. Rule: bulk-eligible = one value applies to every ID; per-ID-only stays --title, --description, --notes, --notes-file, --from-file, --child-order; --status stays with close/reopen. Bulk --parent: resolve once; run checkParentAssignment (issue-hierarchy.ts:52-83) for every ID against the graph as it will be after all moves (parent not among the IDs or their descendants; depth <= MAX_PARENT_DEPTH); abort before any write. Apply: parent_id, spec inheritance when the child has none (update.ts:203-213), hint append once, and removal from each old parent's hints (nothing removes today; schemas.ts:300-303). Bulk --spec propagates per update.ts:257-274. Extract the copy-pasted hint append (update.ts:239-255, create.ts:222-238, integration-runner.ts:623) into lib/child-order.ts. Generate the refusal message's list from the flag table; tbd-design.md:3021-3023 lists a different set today. Tryscripts: set containing the parent, set containing an ancestor of the parent, legal move; old-parent hints no longer carry the child (gap in tests/child-order-e2e.test.ts).
