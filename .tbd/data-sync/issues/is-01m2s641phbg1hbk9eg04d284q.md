---
type: is
id: is-01m2s641phbg1hbk9eg04d284q
title: "Merge stack 312 (#309 then #310) when github-merge and B3 confirmation are given"
kind: task
status: open
priority: 1
version: 13
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels: []
dependencies: []
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
child_order_hints:
  - is-01m2sfsd4qhzvazyfw295bpzxy
  - is-01m2vkt95bxebw64rkxa9jx28n
  - is-01m2vmva9sbfzx7k0mrh45kbkf
created_at: 2026-09-18T02:39:23.857Z
updated_at: 2026-09-19T01:52:51.708Z
---
Both layers are code-complete. Heads: #309 9ad8d1972be4ad0246935cd4162efcdf709e6751, #310 c99a141acb2874b21f819214862afb6209b36b03. Formal stack 312; merge #309 into main first, then #310. CI on these heads was still running when Review I was compiled.

Review H (senior, round 5) is published as PR comment 5735473920 at head eca9187c with no findings; dispositions posted (5735478947; S2 bead ID corrected in 5735485390 to tbd-thw9). S1 declined. Review I (follow-up, round 6) covers eca9187c..9ad8d197: two Medium findings (I1, I2) fixed in 9ad8d197. Body ready at /tmp/review-I-309.md; posting blocked in the review worker (no ManagePullRequest; gh 403) — leftover tbd-azgv.

Do not merge until (1) github-merge permits it — effective grants still come from origin/main, where every policy is unanswered — and (2) the user confirms each of the seven proposed policy-block values by name: github-workflows: granted, github-editing: granted, github-merge: confirm-session, github-stacked-prs: granted, subagents: granted, pr-review-requirements: standard, linear: epics + specs. linear: epics + specs is wider than --policies=recommended would write (that policy's recommended value is unset; its grant value is epics), so read it back verbatim.

Process gaps that do not reopen the code-review bar: Review F has dispositions but no published tbd:review artifact; unmarked Bugbot on #309 has no dedicated disposition reply (finding fixed in the H span); both PR bodies are stale (owner-only edit; tbd-m85z closed).

## Notes

Review I + dispositions published on #309 via ManagePullRequest. CI green on #309 9ad8d197 and #310 c99a141a. Merge still waits on github-merge permission and the seven named grant confirmations. Do not treat the doc commits as merge authorization.
