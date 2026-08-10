---
type: is
id: is-01kzn50yv2cr9whnp5aq7smyjf
title: "integrations/core/permalink.ts: spec permalinks across branches"
kind: task
status: closed
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzn50zedj6hwqx4j3e07mwqy
parent_id: is-01kzn2w9w9gx9j6h3b250jnyzf
created_at: 2026-08-10T06:16:10.849Z
updated_at: 2026-08-10T19:54:57.190Z
closed_at: 2026-08-10T19:54:57.190Z
close_reason: "Phase 1 complete in claude/linear-integration (5300cf30). Validated live against Linear: 82 issues mirrored into the tbd project, idempotent on re-run, bulk guard enforced."
---
spec_path points into a BRANCH-LOCAL file: this repo has 15 specs on one branch and 11 on main, four existing on only one. specPermalink() resolves which branch holds the file (git ls-tree <branch> -- <path>, falling back to main) and emits blob/<branch>/<path> while in flight, rewritten to blob/<merge-sha>/<path> when the bead closes. A naive path mirror produces links that 404 depending on who clicks and when. Spec Component 5.

## Notes

Module is complete and unit-tested (parseRepoSlug, blobUrl, findBranchContaining, specPermalink). NOT wired into the mirror command yet: planMirror takes optional specUrl/repoUrl callbacks that the command does not yet supply, so mirrored issues currently carry no spec permalink.
