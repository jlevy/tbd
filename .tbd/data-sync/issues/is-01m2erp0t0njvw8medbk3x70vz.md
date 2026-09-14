---
type: is
id: is-01m2erp0t0njvw8medbk3x70vz
title: "Land the coordination stack: #278 -> #279 -> #282 -> #283"
kind: task
status: closed
priority: 1
version: 10
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies: []
parent_id: is-01m1w39s0rrg0dp4p90cb4gg67
child_order_hints:
  - is-01m2erphcs95gs5fysj2dvrghy
  - is-01m2erphvafq7s0t4fa4q7enpa
  - is-01m2erpjam82cmvb04dvjknhe8
  - is-01m2erpjrg6pwg8fjveft1s99f
  - is-01m2esegwz6k3bph39z6w4mdat
  - is-01m2eseh97vth3cpm35m074faf
created_at: 2026-09-14T01:32:08.380Z
updated_at: 2026-09-14T04:19:59.425Z
closed_at: 2026-09-14T04:19:59.425Z
close_reason: "All four layers merged to main on 2026-09-14: #278 (a308568 via tbd-o2ob), #279 (tbd-8rnq), #282 (tbd-g58e), #283 (9753fad5 via tbd-w3tv). main CI green on 52d5c2f7 (all six jobs). Format unchanged at f08. NOTE: the stack landed with tbd-s3zx unfixed, so the third-party extensions.<ns>.comments regression is now live on main — see that bead."
resolution: null
duplicate_of: null
---
Land the coordination stack bottom to top: #278 (codex/bead-coordination-review, base main) -> #279 (codex/stability-comment-recovery) -> #282 (codex/native-comment-model) -> #283 (codex/native-comment-inventory). The PRs are chained by base branch, not registered with gh stack. Repo settings: merge commits allowed, delete_branch_on_merge on, so merging one layer retargets the next to main.

Merge gate for each layer: exact-head CI green on all seven checks; mergeable CLEAN; the layer's review findings dispositioned; no unresolved release-compatibility finding against that layer (see the compatibility review beads under this one). Record the merge commit on the layer bead and on the closed implementation beads that shipped in it (tbd-hqb9 for #279, tbd-e1tu for #282, tbd-4r3w and tbd-c4zl for #283).

2026-09-14: #280 merged to main; #278/#279/#282 restacked onto it with identical trees; #283 restacked onto #282's new head (a48a4416 -> 175eac50, patch-identical range-diff, identical tree) so it is mergeable again.

2026-09-14: local stale copies of the stack branches exist at their pre-restack heads (codex/bead-coordination-review bb0f54c8, codex/stability-comment-recovery c9c65169, codex/native-comment-model be815943, and codex/native-comment-inventory a48a4416 checked out in the Codex worktree /Users/levy/.codex/worktrees/fbe5/tbd). Force-pushing any of them would undo the restacks and #283's docs commit 4a42a6ac; reset them to origin before further work there. Stage A of the merge, release, and format upgrade map in the stability sprint plan (PR #277).

2026-09-14: all four layers merged to main in 9753fad5 (#278, #279, #282, #283). #279 merged before its gates closed, so tbd-s3zx, tbd-apnu, and tbd-cskr now apply to main and gate the release through tbd-lz1q. Remote stack branches were deleted on merge; the stale local copies noted above are now only cleanup. Keep this bead open until tbd-cskr and tbd-lz1q close.
