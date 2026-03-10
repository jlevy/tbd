---
type: is
id: is-01kf5zyg8p4jjx0knat42pg6r2
title: Golden tests for tbd prime command
kind: task
status: closed
priority: 1
version: 6
labels: []
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-17T07:23:06.597Z
updated_at: 2026-03-09T16:12:30.457Z
closed_at: 2026-01-17T10:00:06.561Z
close_reason: Done - cli-prime.tryscript.md with 12 tests
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.750Z
    original_id: tbd-1880
---
Create golden tests for tbd prime command.

**Test scenarios:**
1. tbd prime in initialized project - outputs workflow context
2. tbd prime outside tbd project - exits silently (code 0)
3. tbd prime --format=json - JSON output format
4. tbd prime --format=brief - Brief output format
5. tbd prime --quiet - Suppresses output if not in tbd project

Create cli-prime.tryscript.md following the golden testing guidelines.
