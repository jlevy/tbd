---
type: is
id: is-01m3re458naz8s8bzmczx897w7
title: "Review and resolve stack #309/#310 end to end; refresh model tiers"
kind: task
status: closed
priority: 1
version: 14
delegate: claude-code@spud10.local
labels: []
dependencies: []
child_order_hints:
  - is-01m3re9rgxs7ck9jq4cm4hzzy1
  - is-01m3re9rxvhrhpxk9vj83bzaq2
  - is-01m3re9sb0d419ks3fpe738rn4
  - is-01m3re9srb4zq573sgftckbxsh
  - is-01m3re9t57p0nwah2sd804mg18
  - is-01m3re9thxcstdyf6jbbn10wqa
  - is-01m3redybwrgsva2ge4mq0tb91
  - is-01m3redyrpy2rgbapk9zz85604
  - is-01m3redz4hh3zxpbg1z54b0s0f
  - is-01m3redzgkwhc7egk3x4a5g70a
hold: null
hold_until: null
created_at: 2026-09-30T05:55:43.508Z
updated_at: 2026-09-30T06:52:05.421Z
started_at: 2026-09-30T05:56:08.727Z
closed_at: 2026-09-30T06:52:05.420Z
close_reason: Full stack review and addressing complete; fixes, descriptions, dispositions, and exact-head CI verified. Existing policy decision and pre-existing follow-ups remain explicitly tracked.
resolution: null
duplicate_of: null
---

## Notes

Completed review/fix pass for the #309/#310 stack. Senior P and security Q on #309 and senior G on #310 were published; all ten new findings and the N6/N9/N23 cleanup are fixed. GPT-6 Sol audited current model sources and updated research. Standard Claude is pinned Opus 5.5; Codex uses GPT-6 Astra and GPT-6.1 Sol with an explicit availability fallback.

Pushed lower a4aa652ddeb57e4f796222b5a51e34b978b1338c and upper c0a41bc5042513e029a6215b292ff9a02a080964. Both layers passed all seven checks; CI runs 36679123949 and 36679127271 completed successfully. Both local full suites passed 3017 tests (one skipped); lower full CLI suite passed1164 checks, upper updated documentation golden passed9; quality/pre-push hooks passed.

Dispositions: https://github.com/jlevy/tbd/pull/309#issuecomment-5905790764 ; https://github.com/jlevy/tbd/pull/309#issuecomment-5905791168 ; https://github.com/jlevy/tbd/pull/310#issuecomment-5905791410 . PR descriptions are current. No new actionable feedback in final sweep.

No merge requested or performed. Existing named policy confirmation remains in tbd-px37/tbd-45q1. Pre-existing dependency audit and broader Codex hooks concerns remain separately tracked in tbd-b24q/tbd-d2bp. Left on upper branch with clean tree. External build/cache setup: source /Volumes/spud-ext1/agent-scratch/tbd-stack310-review/env.sh before further builds. Pre-existing stash was preserved.
