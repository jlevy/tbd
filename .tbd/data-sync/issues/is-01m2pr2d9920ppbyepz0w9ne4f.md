---
type: is
id: is-01m2pr2d9920ppbyepz0w9ne4f
title: "P4: Run Review and fix on PR #309 with sub-agents"
kind: task
status: in_progress
priority: 1
version: 8
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
delegate: unknown@cursor
labels:
  - exec:judgment
dependencies:
  - type: blocks
    target: is-01m2pr2e0dq28pt5eydmghyeht
  - type: blocks
    target: is-01m2pr2edgrgckr42003704bwh
  - type: blocks
    target: is-01m2pr2dmqqap2nf1xmjbwztaj
  - type: blocks
    target: is-01m2rw79zh70pgacskvw9ejkqy
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
child_order_hints:
  - is-01m2rw9zzs69gde6ayhc8z6pwt
hold: null
hold_until: null
created_at: 2026-09-17T03:55:21.257Z
updated_at: 2026-09-17T23:47:52.953Z
started_at: 2026-09-17T23:46:31.344Z
---
Plan: Implementation Plan > Phase 4 item 2; Testing Strategy > Live validation. Coordinator-run after Phases 1-3 land; involves the user.

What: run review-and-merge-prs in fix mode ("Review and fix") on PR #309 with sub-agents: a strong-tier reviewer publishes a formal, marked review pinned to the current head; a moderate-tier addressing agent addresses it as sole committer and posts the marked disposition reply; the coordinator verifies the claims and asks the user before any further round. Record the requested tiers, the questions asked, and what worked or did not in a new Outcome Notes section of the plan.

Write set: the plan spec (Outcome Notes); fixes on the PR branch by the addressing agent.

Acceptance: the review exists with its marker and `commit_id` equal to the pinned head (gh api); the disposition reply lists every finding; required CI is final and green at the final head; Outcome Notes has an entry.
