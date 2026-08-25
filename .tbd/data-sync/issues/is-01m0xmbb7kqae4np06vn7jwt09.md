---
type: is
id: is-01m0xmbb7kqae4np06vn7jwt09
title: Prefer language-neutral tests when they preserve the same coverage
kind: task
status: open
priority: 2
version: 1
labels: []
dependencies: []
parent_id: is-01m0xm7a8pywqqpqn451h4tdsv
created_at: 2026-08-25T23:33:37.139Z
updated_at: 2026-08-25T23:33:37.139Z
---
*Always* prefer tests that are language-neutral, as this facilitates porting to other languages. For example, golden tests for CLIs should always be preferred over unit tests or integration tests if the same coverage is present, because they allow a program to be ported—for example, from Python to Rust—without having to port the tests. This is an overlooked and very important point.

Make the same-coverage condition explicit, explain the portability rationale, and give a concrete CLI golden-test example. Leave it up to the agent to determine when the behavior can actually be specified language-neutrally.
