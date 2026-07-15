---
type: is
id: is-01kv1cz023gkjyg2eyrkakmtzb
title: Vitest unit tests for bulk.ts
kind: task
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-06-13-agent-cli-ergonomics.md
labels: []
dependencies: []
parent_id: is-01kv199q7mbcqxrvfd6jpecxnk
created_at: 2026-06-13T21:07:19.235Z
updated_at: 2026-06-13T21:17:00.111Z
closed_at: 2026-06-13T21:17:00.111Z
close_reason: "Done in commit dfb57d8: 8 vitest unit tests for bulk.ts (resolveAllIds, summarizeBulk, toJsonResult). Pushed; full suite green."
---
Unit tests for resolveAllIds (order, missing collection), summarizeBulk (changed/skipped/missing tallies), toJsonResult (skippedReason omission). Complements the e2e goldens.
