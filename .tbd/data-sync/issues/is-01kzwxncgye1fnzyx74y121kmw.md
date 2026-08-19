---
type: is
id: is-01kzwxncgye1fnzyx74y121kmw
title: "Web: report clear errors for uninitialized or invalid base paths"
kind: task
status: closed
priority: 1
version: 3
labels:
  - review
  - web
dependencies: []
parent_id: is-01kzwv4rgyczfrw9dbxfw9f7x2
created_at: 2026-08-13T06:41:27.069Z
updated_at: 2026-08-13T07:16:17.480Z
closed_at: 2026-08-13T07:16:17.480Z
close_reason: Fixed in 5f32e14f with focused TDD and full release-gate validation
---
File/function scope: packages/tbd/src/cli/commands/web.ts WebHandler.run and packages/tbd/tests/cli-web.test.ts. Prove a Git repository without .tbd and a directory outside any initialized tbd repository fail with the standard NotInitializedError text and exit code 1; a nonexistent path should be a clear path error rather than an opaque stack trace.

## Notes

TDD complete: spawned-process coverage proves standard NotInitializedError text and exit 1 for Git and plain directories without tbd metadata, plus a clear exit-2 validation error for a missing base. packages/tbd/src/cli/commands/web.ts resolveBaseDirectory validates/canonicalizes paths before shared requireInit discovery.
