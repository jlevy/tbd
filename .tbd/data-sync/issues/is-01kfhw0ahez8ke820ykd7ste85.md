---
type: is
id: is-01kfhw0ahez8ke820ykd7ste85
title: Add unit tests for DocCache
kind: task
status: closed
priority: 1
version: 9
labels: []
dependencies:
  - type: blocks
    target: is-01kfhvzn1vbsam9xckr0njfbqg
created_at: 2026-01-22T03:29:40.397Z
updated_at: 2026-03-09T16:12:32.024Z
closed_at: 2026-01-23T02:43:26.863Z
close_reason: "Implemented: doc-cache.test.ts has comprehensive unit tests (440+ lines) covering load, get, list, and path ordering"
---
Create tests/file/doc-cache.test.ts with unit tests: get() exact matching with/without .md extension, search() scoring algorithm with various queries, list() with and without shadowed docs, path ordering (earlier paths take precedence), error handling (missing dirs, invalid markdown).
