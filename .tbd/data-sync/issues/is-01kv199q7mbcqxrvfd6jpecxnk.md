---
type: is
id: is-01kv199q7mbcqxrvfd6jpecxnk
title: "Tests: bulk mutators, atomicity, quiet and json contract"
kind: task
status: closed
priority: 2
version: 4
spec_path: docs/project/specs/active/plan-2026-06-13-agent-cli-ergonomics.md
labels: []
dependencies: []
parent_id: is-01kv197ns6jwkg2q82w7awjn15
child_order_hints:
  - is-01kv1cz023gkjyg2eyrkakmtzb
  - is-01kv1cz1dnxdszx16zcjsj0cr3
created_at: 2026-06-13T20:03:16.340Z
updated_at: 2026-06-14T16:14:14.057Z
closed_at: 2026-06-14T16:14:14.056Z
close_reason: Bulk mutator/atomicity/quiet/json contract covered by cli-bulk-mutation + cli-crud (single-ID) + cli-body-input (file/stdin bodies) + bulk.test.ts + quiet-notices.test.ts. Added the missing --no-sync-rejected lock to cli-bulk-mutation this commit.
---
Phase 1 tests. tryscript goldens: bulk close/reopen/update with mixed already-closed and unknown IDs; --ignore-missing; single-ID backward compatibility; --reason-file and stdin bodies; --quiet single-line output; the --json results array shape. vitest: validate-all-then-apply policy and summary exit codes (non-zero when any target failed).
