---
type: is
id: is-01kfv2kq1tptewzzk901njccnj
title: Unit tests for hasGitignorePattern()
kind: task
status: closed
priority: 2
version: 8
labels: []
dependencies:
  - type: blocks
    target: is-01kfv2mbbm3rgr07rx3bcanajv
parent_id: is-01kfv2he1c3hct3c07gv0edh90
created_at: 2026-01-25T17:18:17.145Z
updated_at: 2026-03-09T16:12:32.861Z
closed_at: 2026-01-25T17:26:43.151Z
close_reason: null
---
Create comprehensive unit tests for the hasGitignorePattern() detection function.

Test cases:
- Exact match: 'foo/' found in content with 'foo/'
- Normalized match: 'foo' found in content with 'foo/'
- No match: 'bar' not found in content with 'foo/'
- Skip comments: pattern not matched against '#foo/' comment lines
- Skip blank lines: empty lines don't affect matching
- Case sensitivity: 'FOO' does not match 'foo'
- Multiple patterns: correct detection among many lines

File: packages/tbd/tests/gitignore-utils.test.ts
