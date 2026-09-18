---
type: is
id: is-01m2rwdknas74aktcp603tssea
title: "PR #310 A5: OpenAI caching figures in research brief not re-verified"
kind: bug
status: closed
priority: 3
version: 7
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
delegate: unknown@cursor
labels: []
dependencies:
  - type: blocks
    target: is-01m2s4q55b0jftzxey6tt7g16p
parent_id: is-01m2rjv6ppwnh8m4vz1r2z96wk
hold: null
hold_until: null
created_at: 2026-09-17T23:49:51.402Z
updated_at: 2026-09-18T02:39:23.424Z
started_at: 2026-09-17T23:50:56.558Z
closed_at: 2026-09-18T02:39:23.424Z
close_reason: "Fixed in #310 78665299: re-read OpenAI prompt caching and pricing 2026-09-18. GPT-5.6+ is 1.25x write / 0.1x read / 30m TTL with explicit breakpoints for changing suffixes; earlier models keep no write premium. agent-model-tiers unchanged. CI 35299048692 success."
resolution: null
duplicate_of: null
---
Low. Research brief OpenAI caching figures marked not re-verified. Guideline does not copy those dollar figures. Review A: https://github.com/jlevy/tbd/pull/310#issuecomment-5722767108. Fix: leave the mark; keep the re-read as an open bead on tbd-49pp; do not paste unverified prices into agent-model-tiers.
