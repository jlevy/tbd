---
type: is
id: is-01m2v1myrx20kvy5jtjnjezymk
title: "Plan spec Non-Goals: use the task-scoped confirm-session sentence"
kind: task
status: open
priority: 4
version: 1
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels: []
dependencies: []
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
created_at: 2026-09-18T19:59:43.901Z
updated_at: 2026-09-18T19:59:43.901Z
---
Review H suggestion S2 (https://github.com/jlevy/tbd/pull/309, round 5). docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md Non-Goals still says 'a confirmation in the session (confirm-session)' without the task qualifier that the rest of the spec and every other document use: 'a session confirmation covers the task it was given for: the PRs of the task the user confirmed, including every layer of a stack those merges include, and a PR outside that task needs its own confirmation.' It is a summary, not a definition, and the same spec defines the scope fully later, so it does not warrant its own verify-and-push cycle. Fix it when the spec is next edited, which is when the Phase 4 Outcome Notes record the stack 312 merge.
