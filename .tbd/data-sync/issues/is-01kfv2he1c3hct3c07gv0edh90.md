---
type: is
id: is-01kfv2he1c3hct3c07gv0edh90
title: Implement gitignore-utils library
kind: epic
status: closed
priority: 2
version: 7
labels: []
dependencies: []
created_at: 2026-01-25T17:17:02.362Z
updated_at: 2026-03-09T16:12:32.822Z
closed_at: 2026-01-25T17:29:33.911Z
close_reason: null
---
Create reusable utility library for idempotent .gitignore editing with atomic writes.

Spec: docs/project/specs/active/plan-2026-01-25-gitignore-utils-library.md

Goals:
- Detection function: hasGitignorePattern()
- Edit function: ensureGitignorePatterns()
- Refactor init.ts and setup.ts to use new lib
- Full unit test coverage
