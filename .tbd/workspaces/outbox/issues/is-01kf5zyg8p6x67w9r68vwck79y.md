---
close_reason: Complete - tests for claude/cursor/codex done, aider not needed
closed_at: 2026-01-17T09:59:22.109Z
created_at: 2026-01-17T07:23:11.926Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.756Z
    original_id: tbd-1881
id: is-01kf5zyg8p6x67w9r68vwck79y
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Golden tests for tbd setup commands
type: is
updated_at: 2026-03-09T02:47:21.627Z
version: 5
---
Create golden tests for tbd setup commands (claude, cursor, codex).

**Test scenarios - COMPLETED:**

For tbd setup claude:
1. tbd setup claude --check - Reports installation status ✓
2. tbd setup claude --dry-run - Shows what would happen ✓
(Full install test limited due to global config modification)

For tbd setup cursor:
1. tbd setup cursor - Creates .cursor/rules/tbd.mdc ✓
2. tbd setup cursor --check - Reports installation status ✓
3. tbd setup cursor --remove - Removes rules file ✓
4. Verify content includes workflow instructions ✓

For tbd setup codex:
1. tbd setup codex - Creates AGENTS.md ✓
2. tbd setup codex --check - Reports installation status ✓
3. tbd setup codex --remove - Removes tbd section ✓
4. Test adding to existing AGENTS.md ✓

Created cli-setup-commands.tryscript.md with 35 passing tests.

**PENDING: tbd setup aider tests (blocked on tbd-1879 implementation)**
