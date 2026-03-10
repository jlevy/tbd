---
type: is
id: is-01kgc6yjzvfe04mk2815c86g6c
title: Add integration tests for corrupted data scenarios (YAML parse errors, merge conflicts)
kind: task
status: closed
priority: 2
version: 9
labels: []
dependencies: []
parent_id: is-01kgc6hsmxfbrsts7q2mmjrznp
created_at: 2026-02-01T09:01:13.082Z
updated_at: 2026-03-09T16:12:33.660Z
closed_at: 2026-02-01T09:16:48.439Z
close_reason: Added corrupted-data.test.ts with integration tests for merge conflicts and invalid YAML
---
Test scenarios to add:

1. Corrupted ids.yml with merge conflict markers - Run tbd list, verify error mentions YAML parse error (not generic message), verify debug mode shows stack trace

2. Corrupted config.yml - Invalid YAML syntax, verify meaningful error message

3. Missing ID mappings - Issue files exist but ids.yml incomplete, verify error states which issue ID is unmapped

These tests ensure we dont regress on error handling quality. See error-handling-rules.md Anti-Pattern 9
