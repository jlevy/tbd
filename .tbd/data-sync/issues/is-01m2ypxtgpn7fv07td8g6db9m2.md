---
type: is
id: is-01m2ypxtgpn7fv07td8g6db9m2
title: Policy CLI round-trip test exceeds 30s on a loaded macOS host
kind: task
status: open
priority: 3
version: 1
labels: []
dependencies: []
created_at: 2026-09-20T06:09:17.845Z
updated_at: 2026-09-20T06:09:17.845Z
---
Observed while reviewing #309 at baseline b4923d76 before changes and after fixes. cli-policy.test.ts round trips each policy and value times out at its explicit30s even when run alone; other16 CLI tests and54 policy tests pass. Host load averages21-38. Preserve assertions; investigate splitting the many subprocess operations or a measured subprocess budget if this also affects CI. Final OS CI remains the full-suite gate.
