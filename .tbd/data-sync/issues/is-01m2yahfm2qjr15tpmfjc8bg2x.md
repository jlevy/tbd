---
type: is
id: is-01m2yahfm2qjr15tpmfjc8bg2x
title: "Windows CI flake: bead-watch 1s ls-remote and doctor setup hook timeout"
kind: bug
status: closed
priority: 1
version: 4
delegate: unknown@cursor
labels: []
dependencies: []
hold: null
hold_until: null
created_at: 2026-09-20T02:32:50.561Z
updated_at: 2026-09-20T17:16:42.794Z
started_at: 2026-09-20T02:32:57.359Z
closed_at: 2026-09-20T02:38:01.992Z
close_reason: "Test-budget de-flake on #310: c4aff495. Watch isolation uses subprocessTestTimeout(5_000) instead of a 1s deadline; doctor setup hook is 90s / describe 180s. ENOTDIR (tbd-91ej) stayed fixed (setup-tier-agents 18/18 on 18a77e9e; #309 Windows green)."
resolution: null
duplicate_of: null
---
## Summary

Not the ENOTDIR/EEXIST bug (tbd-91ej). That stayed fixed: on 18a77e9e, `tests/setup-tier-agents.test.ts` passed 18/18, and #309 `b4923d76` Windows is green.

#310 Windows failed on a **new** pair of timeouts (CI run 35483514225, job Test windows-latest Node 24):

1. `tests/bead-watch.test.ts` > watchForIssueChanges Git safety > fetches through a temporary private ref and leaves sync state untouched
   - `Failed to read remote sync tip origin/tbd-sync`
   - cause: `git ls-remote --exit-code origin refs/heads/tbd-sync timed out after 970 ms` (`timeoutMs: 970`)
   - The test uses product `timeoutMs: 1_000`. After `prepare()`, remaining poll budget is ~970ms. Local file:// `ls-remote` on a loaded Windows runner exceeded that.

2. `tests/doctor-managed-surfaces.test.ts` > distinguishes current, stale, missing, user-owned, and too-new skills without writes
   - `Hook timed out in 60000ms` at `beforeEach` (`tbd setup --auto`)
   - `subprocessTestTimeout(30_000)` is a 60s Windows floor. The sibling test in the same file passed in 11s on the same job.

## Evidence this is flake / load, not a #310 product regression

- Head `18a77e9e` is docs-only vs `11416dcb`, whose Windows jobs were green twice at 02:09.
- #309 `b4923d76` Windows is green in the same window; both failing test files exist there unchanged.
- Different tests and errors than tbd-91ej (timeout vs ENOTDIR assertion).
- Same file, mixed result: doctor first hook 60s fail, second test 11s pass.

## Fix

Give the Git-safety watch the subprocess I/O budget instead of a 1s deadline. Raise the doctor setup hook above the 60s Windows floor. Land on #310 (309 stays green).

## Notes

2026-09-20 follow-up: 5f29c4dd Windows failed a NEW 60s-floor flake (cli-web, setup-flows, setup-policy-grants), not this watch/doctor pair (those passed). Floors ported onto #309 in cbb25f41; #310 rebased onto that head and dropped duplicate 3e7e19c3. New flake: tbd-8z0f.
