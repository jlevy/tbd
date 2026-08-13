---
type: is
id: is-01kzx0g7w12vqnv0b8a8svx851
title: "CI: make merge-refs temporary repository cleanup retry-safe"
kind: bug
status: closed
priority: 1
version: 2
labels:
  - pr-review
  - ci
dependencies: []
parent_id: is-01kzwv4rgyczfrw9dbxfw9f7x2
created_at: 2026-08-13T07:31:04.192Z
updated_at: 2026-08-13T07:39:35.710Z
closed_at: 2026-08-13T07:39:35.706Z
close_reason: "Fixed in 18b7e0e0: merge-refs temp cleanup now retries transient recursive-rm failures; 10 focused runs, exact coverage command (1,635 Vitest plus 1,076 tryscript), format, lint/typecheck, and build all pass."
---
Hosted Coverage & Lint on PR #209 failed after all 1,635 test assertions completed because merge-refs.test.ts afterEach removed a Git temp repository without transient-error retries and hit ENOTEMPTY in .git/objects/pack. Scope: packages/tbd/tests/merge-refs.test.ts cleanup hook and focused regression/validation. Disposition target: fixed with retry-safe recursive cleanup; no product behavior change.
