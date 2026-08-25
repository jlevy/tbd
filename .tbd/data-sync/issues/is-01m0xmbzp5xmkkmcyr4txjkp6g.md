---
type: is
id: is-01m0xmbzp5xmkkmcyr4txjkp6g
title: Replace generic mock advice with concrete vacuous-test rules
kind: task
status: open
priority: 2
version: 1
labels: []
dependencies: []
parent_id: is-01m0xm7a8pywqqpqn451h4tdsv
created_at: 2026-08-25T23:33:58.082Z
updated_at: 2026-08-25T23:33:58.082Z
---
Here is the more bloated generic advice text to be sharpened:

## Assert the Outcome, Not the Interaction

A test that asserts a mock was called proves the code under test called a mock. That is usually the least interesting thing that happened.

- **Assert the contract that crossed the boundary, not that a call occurred.** `expect(store.save).toHaveBeenCalled()` passes when the wrong object is saved. Assert the shape and the values that the receiving component depends on.
- **Never assert that a mock has the methods you gave it.** A test that checks `typeof mock.process === 'function'` tests the test.
- **Test the data flow between components**, not each call in isolation. The defects worth catching live in what one component hands the next.
- **Prefer a real collaborator to a mock** wherever it is fast and deterministic. A mock encodes your belief about the dependency; a real one encodes the dependency.

Sharpen this around "Don't Just Test the Test" and specific vacuous-test patterns. Keep only guidance that changes a competent agent's test design, with concrete rationale and examples.
