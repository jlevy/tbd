---
type: is
id: is-01m0xmbnx9gzr1xxts9ckvzv78
title: Sharpen Demand Independent Evidence into concrete test-retention rules
kind: task
status: closed
priority: 2
version: 2
labels: []
dependencies: []
parent_id: is-01m0xm7a8pywqqpqn451h4tdsv
created_at: 2026-08-25T23:33:48.072Z
updated_at: 2026-08-26T00:33:11.678Z
closed_at: 2026-08-26T00:33:11.677Z
close_reason: Replaced Demand Independent Evidence with concrete keep, merge, collapse, stronger-oracle, and externally-distinct-failure rules.
resolution: null
duplicate_of: null
---
Here is the more bloated generic advice text to be sharpened:

## Demand Independent Evidence

Coverage means required behavior, not a line count. A smaller suite is better only while it preserves every independent contract, boundary, failure mode, and useful failure location the larger suite established.

- **Make each test name what it uniquely establishes.** If that sentence cannot be written, the test is not earning its place. This is usually visible in the name: a test called `handles_empty_input` states one; `test_process_2` does not.
- **Keep intentional overlap when it buys evidence or diagnosis.** Two tests that execute the same lines can protect different public contracts or localize a regression to one layer. That is not the needless duplication prohibited above.
- **Prefer a stronger oracle to another example.** When a behavior has a property that holds for all inputs, a property test with a fixed seed beats five hand-picked cases. When a rewrite must match an old implementation, a differential test beats both. When a failure path is hard to reach, use fault injection.

Tighten this section so it is immediately actionable and likely to trigger a competent coding agent to do something differently. Preserve only specific test-retention decisions, rationale, and examples; do not restate generic coverage advice.
