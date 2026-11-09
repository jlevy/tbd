---
type: is
id: is-01m6yzfa7ymxkgmjkarag0vba5
title: Prepare and validate the get-tbd 0.10.1 patch release
kind: task
status: in_progress
priority: 1
version: 11
delegate: codex@spud10
labels: []
dependencies: []
child_order_hints:
  - is-01m6z00pw4z3rnhsceck0k3dke
  - is-01m6z00qd6eaav9q66mxr7h7yx
  - is-01m6z00r6zde8eyj94s1yqc1jp
  - is-01m6z00s8x62caj7h0ekr9k88n
  - is-01m6z00t8v0j9fjdy2zx3zgsd1
  - is-01m6z00wbrt7cyz3zhhf4yf9nk
  - is-01m6z00wrrfm7c0es6hm6g9x0v
hold: null
hold_until: null
created_at: 2026-11-09T01:41:26.909Z
updated_at: 2026-11-09T02:18:01.550Z
started_at: 2026-11-09T01:41:40.058Z
---
Review the open PR queue, merge eligible patch work after review and CI, audit the dependency delta, verify a packed release and downstream upgrade, and prepare the 0.10.1 release PR.

## Notes

Merged #334, #335, #330, and #333 after all review dispositions and pinned green CI. Integrated main is 30c8f597. Deferred #21, #174, #253, #324, #329, and #332 with published reviews and tracked findings. Production pnpm audit reported zero and all 31 pins passed cooldown. Release version awaits user decision. Merged #331 changes exported Zod schema types (IssueSchema inference and Timestamp methods) and the Zod 4.6.7 /v3 path reproduced the advisory behavior. Continue with an approved 0.11.0 with migration notes or a reviewed compatible security backport before 0.10.1. Downstream Tryscript baseline cdbe59c is prepared. Its functional gate passed and production audit was zero. Three baseline moderate dev advisories are documented. Evidence: /Users/levy/wrk/release-evidence/tbd-v0.10.1/downstream/current/.
