---
type: is
id: is-01m0xm7a8pywqqpqn451h4tdsv
title: Optimize testing guidance for five simultaneous properties
kind: epic
status: closed
priority: 2
version: 13
labels: []
dependencies:
  - type: blocks
    target: is-01m0xmcxvqt3p2qz7p4netcne2
child_order_hints:
  - is-01m0xma9qkvysyt0kn73pxzdyg
  - is-01m0xmafvdgyftr42fd8y9cbp2
  - is-01m0xmanmz8exw6jrb7q6406pg
  - is-01m0xmaxpmqg92tzvnjjjhan2t
  - is-01m0xmb43bh5zfgdefgyyjtaa0
  - is-01m0xmbb7kqae4np06vn7jwt09
  - is-01m0xmbnx9gzr1xxts9ckvzv78
  - is-01m0xmbzp5xmkkmcyr4txjkp6g
created_at: 2026-08-25T23:31:25.076Z
updated_at: 2026-08-26T00:33:12.275Z
closed_at: 2026-08-26T00:33:12.273Z
close_reason: Completed the testing-guidance epic with a shorter, more actionable general testing guide centered on the five simultaneous suite properties.
resolution: null
duplicate_of: null
---
Let's tighten up the testing doc and keep it focused. Much of your advice is very generic and not immediately actionable or likely to trigger a competent coding agent to do a lot differently.

Probably the most important principle here is "Don't Just Test the Test": Don't write a test that does nothing but check the assumptions of the test itself, like checking that the initialization happened or that a created object contains the fields it was just instantiated with. There are many vacuous tests like this written by agents.

The other key principle is that it should not be discouraging reducing the volume of tests. It's very important to keep the volume of tests as low as possible while *simultaneously* keeping the coverage as high as possible. Excessive test fluff is a serious cost just as inadequate testing is. The only solution is to simultaneously optimize for five things:

1. concision (volume of total test data and logic as low as possible)
2. clarity (clearly correct and easy to update or see if the test is wrong, so it is maintainable)
3. coverage (as much as reasonably possible)
4. efficiency (the inner loop of tests, such as on commit and CI, should always be as fast as possible, as it is a constant tax on all software development; outer loops of slower or more manual tests should be added when that cannot be achieved within budget via any reasonable means)
5. portability (*always* prefer tests that are language-neutral, as this facilitates porting to other languages. For example, golden tests for CLIs should always be preferred over unit tests or integration tests if the same coverage is present, because they allow a program to be ported—for example, from Python to Rust—without having to port the tests. This is an overlooked and very important point.)

Make sure the beads emphasize my strong expectation of very specific language and specific examples over general guidance that any agent would already know.

## Notes

This is not the same as saying everything is overly prescriptive. It needs to be very specific, with specific rationale, and leave it up to the agent to decide when to use the principles described in those guidelines.
