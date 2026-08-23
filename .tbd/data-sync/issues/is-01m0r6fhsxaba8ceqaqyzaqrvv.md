---
type: is
id: is-01m0r6fhsxaba8ceqaqyzaqrvv
title: "PR #258 review R18: define the release unit before one-version policy"
kind: bug
status: closed
priority: 2
version: 3
labels:
  - review
dependencies: []
parent_id: is-01m0r5wdr6nrtymyeq46b5qnjr
created_at: 2026-08-23T20:55:02.716Z
updated_at: 2026-08-23T21:21:56.742Z
closed_at: 2026-08-23T21:21:56.742Z
close_reason: Fixed in a55041a0 with focused documentation corrections and regression coverage where executable.
---
packages/tbd/docs/guidelines/release-engineering-rules.md. One version/tag is correct within a declared release unit, not universally across independently versioned monorepo packages. Add the missing boundary without weakening identity checks.
