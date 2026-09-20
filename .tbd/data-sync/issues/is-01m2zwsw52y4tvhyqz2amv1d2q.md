---
type: is
id: is-01m2zwsw52y4tvhyqz2amv1d2q
title: "Windows CI flake: 60s timeouts on web, setup-flows, and policy-grants"
kind: bug
status: in_progress
priority: 1
version: 2
delegate: unknown@cursor
labels: []
dependencies: []
hold: null
hold_until: null
created_at: 2026-09-20T17:11:14.338Z
updated_at: 2026-09-20T17:11:17.980Z
started_at: 2026-09-20T17:11:17.980Z
---
## Summary

Not ENOTDIR (tbd-91ej) and not the #310 watch 1s / doctor 60s pair (tbd-5n6g). Those stayed green on 5f29c4dd: setup-tier-agents 24/24, bead-watch 18/18, doctor-managed-surfaces 2/2.

Windows CI run 35524002993 (job Test windows-latest Node 24) failed three **different** tests at the 60s subprocess floor:

1. `tests/cli-web.test.ts` > serves the packaged page and APIs with isolated, platform-safe lifecycle cleanup — timed out in 60000ms (sibling tests 7s / 14s). Cleanup then hit EBUSY rmdir.
2. `tests/setup-flows.test.ts` > preserves non-gh SessionStart hooks when adding/removing gh hook — timed out in 60000ms (siblings 8–10s). Two full `setup --auto` runs; comment promised a longer timeout but none was passed.
3. `tests/setup-policy-grants.test.ts` > refuses a block whose markers share a line instead of deleting its grants — timed out in 60000ms (sibling 15s).

Ubuntu/macOS green. Same-file mixed results. Load flake after 5f29c4dd (policy HTML visibility) and 4959afea (heavier setup/doctor), not a product hang.

## Fix

On #309: raise the shared Windows `subprocessTestTimeout` floor 60s → 90s; give the multi-setup gh-hook case 120s and web describe 90s; port the #310 watch (`timeoutMs: subprocessTestTimeout(5_000)`) and doctor hook 90s / describe 180s floors so they are not child-only. Then rebase #310 `--onto <new-309> 5f29c4dd`.
