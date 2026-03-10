---
type: is
id: is-01kft6c1mtr4cbk757zqhpf6en
title: "GREEN: Implement README parser to extract doc references"
kind: task
status: closed
priority: 2
version: 10
labels: []
dependencies:
  - type: blocks
    target: is-01kft6c1wrs2jwc9xpft0eztyc
created_at: 2026-01-25T09:04:45.721Z
updated_at: 2026-03-09T16:12:32.656Z
closed_at: 2026-01-25T09:08:26.876Z
close_reason: Parser implemented, all 4 tests pass
---
Implement extractDocReferences() that parses README markdown tables for shortcuts, guidelines, templates sections. Return {shortcuts: string[], guidelines: string[], templates: string[]}.
