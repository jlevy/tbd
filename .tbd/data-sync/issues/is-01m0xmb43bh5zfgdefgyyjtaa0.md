---
type: is
id: is-01m0xmb43bh5zfgdefgyyjtaa0
title: Separate fast inner-loop tests from slower outer-loop evidence
kind: task
status: open
priority: 2
version: 1
labels: []
dependencies: []
parent_id: is-01m0xm7a8pywqqpqn451h4tdsv
created_at: 2026-08-25T23:33:29.834Z
updated_at: 2026-08-25T23:33:29.834Z
---
The inner loop of tests, such as on commit and CI, should always be as fast as possible, as it is a constant tax on all software development. Outer loops of slower or more manual tests should be added when that cannot be achieved within budget via any reasonable means.

Give specific rationale and examples for assigning evidence to the inner or outer loop. Keep the decision contextual rather than prescribing one universal time budget.
