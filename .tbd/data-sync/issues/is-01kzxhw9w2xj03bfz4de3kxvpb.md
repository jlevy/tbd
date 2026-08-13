---
type: is
id: is-01kzxhw9w2xj03bfz4de3kxvpb
title: Prevent stale Linear comment replay after unlink
kind: bug
status: closed
priority: 0
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - review
  - linear
dependencies: []
parent_id: is-01kzx848mdfzapsc2ddm6hm0zt
created_at: 2026-08-13T12:34:45.246Z
updated_at: 2026-08-13T12:50:03.070Z
closed_at: 2026-08-13T12:50:03.069Z
close_reason: Fixed with TDD; documented and full release gates green.
---
PR #206 unresolved review thread PRRT_kwDOQ109P86Y7fM1: a pending post_comment intent can outlive integration unlink, then recovery throws because the local comment namespace/link is gone and every future sync retries the durable journal. Validate and fix so unlink cancels pending writes and replay never mutates the provider or bricks sync when the local claim is no longer live. Add regression coverage and reply/resolve the originating thread.

## Notes

Validated review claim. Fixed with two independent guards: IntegrationUnlinkHandler prunes all pending intent operations for the former bead/external pair under the shared data-sync lock while preserving unrelated ops; runSync replay revalidates every post_comment against the current same-link, same-local-id, still-unpushed claim and consumes superseded journals without provider I/O. Regression proof: journal unit pruning, engine unlink/missing-entry and already-recorded-entry cases, built-CLI unlink with pending update. Full gates: format/lint/typecheck/build; 1,925 Vitest; 1,084 Tryscript; publint; package-age; packed web; native watch RC.
