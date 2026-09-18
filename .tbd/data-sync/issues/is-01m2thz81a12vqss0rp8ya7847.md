---
type: is
id: is-01m2thz81a12vqss0rp8ya7847
title: "PR #309 description still says 'Not ready to merge yet' with three stale Status items"
kind: bug
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels: []
dependencies: []
parent_id: is-01m2thkcy6mtxxrstgdqzstx1p
created_at: 2026-09-18T15:25:43.850Z
updated_at: 2026-09-18T17:23:11.890Z
closed_at: 2026-09-18T17:23:11.890Z
close_reason: "Correction posted as PR comment 5733482014 on #309; only the owner can edit the description"
resolution: null
duplicate_of: null
---
Found by the coordinator during the round-4 merge-readiness check, not by a reviewer. https://github.com/jlevy/tbd/pull/309 body '## Status' section reads 'Not ready to merge yet' and lists: review and merge #306 and #307 (both merged), update this branch from main and resolve doctor.ts / tbd-docs.md overlaps (done), run the review workflow and address it (four rounds done). The description is what a human reads before merging, so it must be corrected or the PR must not claim merge-readiness. ManagePullRequest update_pr may refuse ('not agent-managed', as it did for #310); if it refuses, the owner has to edit it.
