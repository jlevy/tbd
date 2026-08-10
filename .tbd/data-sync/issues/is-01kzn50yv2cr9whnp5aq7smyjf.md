---
type: is
id: is-01kzn50yv2cr9whnp5aq7smyjf
title: "integrations/core/permalink.ts: spec permalinks across branches"
kind: task
status: open
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzn50zedj6hwqx4j3e07mwqy
parent_id: is-01kzn2w9w9gx9j6h3b250jnyzf
created_at: 2026-08-10T06:16:10.849Z
updated_at: 2026-08-10T17:36:03.072Z
---
spec_path points into a BRANCH-LOCAL file: this repo has 15 specs on one branch and 11 on main, four existing on only one. specPermalink() resolves which branch holds the file (git ls-tree <branch> -- <path>, falling back to main) and emits blob/<branch>/<path> while in flight, rewritten to blob/<merge-sha>/<path> when the bead closes. A naive path mirror produces links that 404 depending on who clicks and when. Spec Component 5.

## Notes

Module is complete and unit-tested (parseRepoSlug, blobUrl, findBranchContaining, specPermalink). NOT wired into the mirror command yet: planMirror takes optional specUrl/repoUrl callbacks that the command does not yet supply, so mirrored issues currently carry no spec permalink.
