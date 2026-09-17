---
type: is
id: is-01m2pr2e0dq28pt5eydmghyeht
title: "P4: Run the workflow on PRs #306 and #307"
kind: task
status: open
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels:
  - exec:judgment
dependencies:
  - type: blocks
    target: is-01m2pr2edgrgckr42003704bwh
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
created_at: 2026-09-17T03:55:21.997Z
updated_at: 2026-09-17T06:44:19.544Z
---
Plan: Implementation Plan > Phase 4 item 4. Coordinator-run; needs the user.

What: run review-and-merge-prs on PRs #306 and #307 under the recorded grants: one senior engineering review and its addressing per PR, dedicated reviews where the PR is sensitive, and questions to the user about further rounds. Merge only with the user's explicit confirmation, one PR at a time, re-pinning the other PR after a merge. Record the outcomes in Outcome Notes.

Write set: branches of #306 and #307 (addressing agents); the plan spec (Outcome Notes).

Acceptance: for each PR, a marked review bound to its pinned head, a complete disposition reply, green final CI, and either a merge with the user's confirmation or a stated reason it was not merged.
