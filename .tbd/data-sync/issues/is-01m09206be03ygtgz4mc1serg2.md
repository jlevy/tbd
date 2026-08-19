---
type: is
id: is-01m09206be03ygtgz4mc1serg2
title: "Default policy overselects: spec_path inheritance pulls in every descendant"
kind: bug
status: closed
priority: 1
version: 2
labels: []
dependencies: []
parent_id: is-01m091zrhym1y81tm7g22hheyh
created_at: 2026-08-17T23:48:08.673Z
updated_at: 2026-08-18T00:05:38.171Z
closed_at: 2026-08-18T00:05:38.170Z
close_reason: Fixed in 8fcbacc3. Selection previews now report why beads were selected (kind vs inherited spec_path) and warn when inheritance dominates; the sync fold defaults to guarded so a plain tbd sync no longer waives the bulk guard; the bridge link record is written before the follow-up round trips that previously left half-written pairs; and doctor reports both abandoned lock sidecars (--fix clears provably dead ones) and beads whose link has no bridge record. 2240 tests pass.
---
`policy: default` is documented as "open epics, or anything whose \`spec_path\` points into \`specs/active/\`". That reads like two small sets. It is not, because `spec_path` propagates from a parent bead to every descendant, so the spec clause selects the entire subtree under every epic carrying a live spec.

Measured in the reporting repo: **799 beads selected against 109 real epics**, from 1450 open. Roughly 7x the intended mirror. The preset named `default` is the one a first-time user picks, and it is the one whose behavior least matches its description.

What made it land rather than get caught:

1. The dry run prints a single total. Nothing distinguishes "selected because it is an epic" from "selected because an ancestor had a spec". That breakdown is exactly what a reviewer needs to sanity-check a policy, and it is the number that would have made the problem obvious.
2. The >20-create confirmation guard did **not** fire on a plain `tbd sync`. It guards explicit `integration sync` calls. Since 0.6.0, plain `tbd sync` covers enabled trackers, so the unguarded path is now the common one.

Proposed fixes, any one of which prevents this; ideally all three:

- Break the dry-run and sync summary down by selection reason (N by kind, M by inherited spec_path, and the depth at which each was pulled in).
- Apply the bulk-confirmation guard to the integration surface of plain `tbd sync`, not only to explicit `integration sync`.
- Reconsider whether the spec clause should inherit by default, or require an explicit opt-in for descendant selection.

Docs already warn to size the selection first (setup-linear has a whole section), which is evidence the sharp edge is known. A warning that depends on the operator reading carefully is weaker than a number that shows the shape.

Workaround: inline policy with `kinds: [epic]` and `specs: none`.
