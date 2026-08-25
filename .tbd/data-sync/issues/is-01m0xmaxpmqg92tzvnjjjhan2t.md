---
type: is
id: is-01m0xmaxpmqg92tzvnjjjhan2t
title: Define the five simultaneous test-suite optimization criteria
kind: task
status: open
priority: 2
version: 1
labels: []
dependencies: []
parent_id: is-01m0xm7a8pywqqpqn451h4tdsv
created_at: 2026-08-25T23:33:23.283Z
updated_at: 2026-08-25T23:33:23.283Z
---
The only solution is to simultaneously optimize for five things:

1. concision (volume of total test data and logic as low as possible)
2. clarity (clearly correct and easy to update or see if the test is wrong, so it is maintainable)
3. coverage (as much as reasonably possible)
4. efficiency (the inner loop of tests, such as on commit and CI, should always be as fast as possible, as it is a constant tax on all software development; outer loops of slower or more manual tests should be added when that cannot be achieved within budget via any reasonable means)
5. portability (*always* prefer tests that are language-neutral, as this facilitates porting to other languages)

Define these five criteria in specific, actionable language with rationale. Do not make them unconditional recipes; leave it up to the agent to decide how to balance them for the changed system.
