---
type: is
id: is-01m2pr2dmqqap2nf1xmjbwztaj
title: "P4: Record this repository's policy grants via setup-tbd"
kind: task
status: closed
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels:
  - exec:judgment
dependencies:
  - type: blocks
    target: is-01m2pr2e0dq28pt5eydmghyeht
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
created_at: 2026-09-17T03:55:21.623Z
updated_at: 2026-09-17T16:43:34.323Z
closed_at: 2026-09-17T16:43:34.322Z
close_reason: "User answered the setup questions in this session (all recommended; linear: epics + specs); recorded with tbd policy in AGENTS.md (3cf63211, pushed); effective once #309 merges"
resolution: null
duplicate_of: null
---
Plan: Implementation Plan > Phase 4 item 3. Coordinator-run; needs the user's answers.

What: run the setup-tbd process in this repository using the local build (`node packages/tbd/dist/bin.mjs`, since the released tbd has no `tbd policy` yet): show the current policies, ask the user about every unanswered policy with the recommendations, ask about Linear separately, record only the user's explicit answers, and hand the AGENTS.md policy block change to the coordinator to commit. Note in Outcome Notes how the flow went.

Write set: AGENTS.md (policy block); the plan spec (Outcome Notes).

Acceptance: `tbd policy show` (local build) lists the answers; `tbd doctor` (local build) reports a valid block; the block matches the user's answers exactly.
