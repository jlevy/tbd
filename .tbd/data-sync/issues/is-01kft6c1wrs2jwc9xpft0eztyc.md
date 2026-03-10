---
type: is
id: is-01kft6c1wrs2jwc9xpft0eztyc
title: "RED: Write failing test for shortcut validation"
kind: task
status: closed
priority: 2
version: 10
labels: []
dependencies:
  - type: blocks
    target: is-01kft6c25my1r0ta57nkxe3z5x
created_at: 2026-01-25T09:04:45.975Z
updated_at: 2026-03-09T16:12:32.661Z
closed_at: 2026-01-25T09:09:07.280Z
close_reason: Test written, fails as expected (validateShortcuts not a function)
---
Write test that validates each extracted shortcut name can be loaded via DocCache. Test should fail for any missing/misspelled shortcuts.
