---
type: is
id: is-01m2pr2edgrgckr42003704bwh
title: "P4: Fold validation findings back into the shortcuts"
kind: task
status: open
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels:
  - exec:judgment
dependencies: []
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
created_at: 2026-09-17T03:55:22.416Z
updated_at: 2026-09-17T07:03:09.840Z
---
Plan: Implementation Plan > Phase 4 item 5.

What: fold what the validation runs showed back into the shortcuts, guidelines, and tests (review-and-merge-prs, delegate-to-subagents, the review shortcuts, setup-tbd, agent-model-tiers, and their contract tests), and finish Outcome Notes in the plan. Create a separate bead for any finding too large for this pass.

Write set: decided by the findings; the plan spec (Outcome Notes).

Acceptance: each Outcome Notes finding is either applied, with the targeted tests for the changed docs passing, or tracked by a bead.

## Notes

Findings from implementation runs (2026-09-17):
1. Parallel sub-agents in one checkout collide on builds: packages/tbd/tests/global-setup.ts runs build-if-needed.mjs, which rebuilds dist whenever any doc or source file is newer than dist/bin.mjs, so two agents running vitest while editing docs clobber each other's dist. Mitigation used: only the code agent in a batch runs vitest; docs-only agents run formatting checks and the coordinator runs their tests after the batch. Consider stating this in delegate-to-subagents (parallel writers in one tree must not run build-triggering tests concurrently) and/or a skip-build env in global-setup.
2. User-level agent definitions from another project (~/.claude/agents/*.md created by the squares session) appear in every project's agent list with repo-specific instructions; delegate-to-subagents should tell coordinators to read a definition's body before using an unfamiliar agent type, and tbd's tier definitions should stay project-scoped.
3. Pre-push full suite times out under high machine load; CI is the reliable full-suite check (see user push policy for #309).
