---
type: is
id: is-01m2vmvg29ngn50k7ndgrj9ps1
title: "PR #309 review I1: confirm-every/session sentences in new durable docs"
kind: bug
status: closed
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
delegate: unknown@cursor
labels: []
dependencies: []
parent_id: is-01m2vmva9sbfzx7k0mrh45kbkf
hold: null
hold_until: null
created_at: 2026-09-19T01:35:21.161Z
updated_at: 2026-09-19T01:41:56.041Z
started_at: 2026-09-19T01:35:27.907Z
closed_at: 2026-09-19T01:41:56.041Z
close_reason: "Fixed in 9ad8d197 on #309: confirm-every/session sentences match agent-policy-grants; §6.4.9 names dedicated reviews under standard. Tests in policy-grants-docs.test.ts."
resolution: null
duplicate_of: null
---
packages/tbd/docs/tbd-design.md §6.4.8 and tbd-docs.md policy section. The new summaries said 'an instruction that names a PR' (over-broad vs guideline 'instruction to merge a named PR') and truncated confirm-session (missing 'a PR outside that task needs its own confirmation'). never was not marked set-only. Fix: match agent-policy-grants Merge Authorization.
