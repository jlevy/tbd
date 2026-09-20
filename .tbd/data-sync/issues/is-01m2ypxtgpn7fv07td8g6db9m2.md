---
type: is
id: is-01m2ypxtgpn7fv07td8g6db9m2
title: Policy CLI round-trip test exceeds 30s on a loaded macOS host
kind: task
status: in_progress
priority: 3
version: 3
delegate: codex@spud10
labels: []
dependencies: []
hold: null
hold_until: null
created_at: 2026-09-20T06:09:17.845Z
updated_at: 2026-09-20T06:30:39.052Z
started_at: 2026-09-20T06:30:39.052Z
---
Observed while reviewing #309 at baseline b4923d76 before changes and after fixes. cli-policy.test.ts round trips each policy and value times out at its explicit30s even when run alone; other16 CLI tests and54 policy tests pass. Host load averages21-38. Preserve assertions; investigate splitting the many subprocess operations or a measured subprocess budget if this also affects CI. Final OS CI remains the full-suite gate.

## Notes

Full pre-push run at42b68fe1:2932 passed,10 failed,1 skipped in481s. Failures all wall-clock/performance bounds: action-pins, agent-map-validation(2), doc-references60s, git-remote(3 including45.95ms vs10ms), setup-flows30s, setup-hooks(2x15s). Policy round-trip passed in that full run despite three earlier30s timeouts. Quality/build/precommit pass. Pre-push test hook bypassed for push; exact-head GitHub OS CI required. Logs /tmp/pr309-push.log and /tmp/pr309-roundtrip-isolated.log.
