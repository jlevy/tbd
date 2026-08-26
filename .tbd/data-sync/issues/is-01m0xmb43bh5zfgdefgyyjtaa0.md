---
type: is
id: is-01m0xmb43bh5zfgdefgyyjtaa0
title: Separate fast inner-loop tests from slower outer-loop evidence
kind: task
status: closed
priority: 2
version: 2
labels: []
dependencies: []
parent_id: is-01m0xm7a8pywqqpqn451h4tdsv
created_at: 2026-08-25T23:33:29.834Z
updated_at: 2026-08-26T00:33:11.126Z
closed_at: 2026-08-26T00:33:11.125Z
close_reason: Defined the measured edit, commit, and ordinary-CI inner loop plus named platform, scheduled, hardware, live-service, and manual outer tiers for inherently costly evidence.
resolution: null
duplicate_of: null
---
The inner loop of tests, such as on commit and CI, should always be as fast as possible, as it is a constant tax on all software development. Outer loops of slower or more manual tests should be added when that cannot be achieved within budget via any reasonable means.

Give specific rationale and examples for assigning evidence to the inner or outer loop. Keep the decision contextual rather than prescribing one universal time budget.
