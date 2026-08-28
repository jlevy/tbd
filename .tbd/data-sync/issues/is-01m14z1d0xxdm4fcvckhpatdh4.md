---
type: is
id: is-01m14z1d0xxdm4fcvckhpatdh4
title: "Dry-run and execute disagree about direction: --pull announces 'would push'"
kind: bug
status: open
priority: 1
version: 1
spec_path: docs/project/specs/active/plan-2026-08-28-sync-convergence-and-stability.md
labels: []
dependencies: []
parent_id: is-01m14yzbwwg92e5k7z7d4kyn00
created_at: 2026-08-28T19:55:06.653Z
updated_at: 2026-08-28T19:55:06.653Z
---
GH #265 defect 3, confirmed. The dry-run branch populates report.pushed and report.pulled with no inboundOnly gate at all (sync-engine.ts:1022-1031). The execute path records a push only under !inboundOnly (sync-engine.ts:1306-1310). The two paths mean different things by the same word, which is why 'tbd --dry-run integration sync --pull' announces 'would push 13'.

The engine documents an intent for this (sync-engine.ts:154-162): 'the direction gates what is APPLIED, so the report still names what the suppressed half would have done'. But only the dry-run path implements it, and printSyncReport renders the suppressed half in the same vocabulary as work that will happen. An operator cannot distinguish 'this run will push 13' from '13 would push if you ran the other direction'. #265 reports three mutually inconsistent numbers for one state across bare, --pull and --push.

Fix: pick one contract and make both paths honor it. Either gate the dry-run population on inboundOnly to match execute, or record the suppressed half on both paths; either way render it in its own vocabulary rather than the verb for work that will happen.

Open question for the spec: whether the suppressed half belongs in the report at all. If it stays it needs distinct wording; if it goes, --pull becomes a genuine narrowing of the plan.
