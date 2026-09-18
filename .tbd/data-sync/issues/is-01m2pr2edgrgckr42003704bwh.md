---
type: is
id: is-01m2pr2edgrgckr42003704bwh
title: "P4: Fold validation findings back into the shortcuts"
kind: task
status: closed
priority: 1
version: 7
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
delegate: unknown@cursor
labels:
  - exec:judgment
dependencies:
  - type: blocks
    target: is-01m2s4q55b0jftzxey6tt7g16p
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
hold: null
hold_until: null
created_at: 2026-09-17T03:55:22.416Z
updated_at: 2026-09-18T02:39:23.165Z
started_at: 2026-09-18T02:14:53.339Z
closed_at: 2026-09-18T02:39:23.165Z
close_reason: "Folded into #309 34db3783: parallel-writer/dist, project-scoped tbd-* agents, GitHub CI as full-suite gate, reviews-API 403 fallback, --notes replace semantics; contract tests in review-lifecycle-contract.test.ts. CI 35299039050 success."
resolution: null
duplicate_of: null
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
4. tbd update --notes replaces a bead's notes rather than appending; the coordinator overwrote notes once (restored). Consider an append option or warn in docs.
