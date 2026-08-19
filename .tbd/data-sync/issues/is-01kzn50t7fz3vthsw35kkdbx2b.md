---
type: is
id: is-01kzn50t7fz3vthsw35kkdbx2b
title: "integrations/linear/queries.ts: operations + zod response schemas"
kind: task
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzn50tnf2yx0ndsgpfqw91mb
parent_id: is-01kzn2w8x0c038fhk1c859248r
created_at: 2026-08-10T06:16:06.126Z
updated_at: 2026-08-10T17:35:53.909Z
closed_at: 2026-08-10T17:35:53.909Z
close_reason: Implemented in claude/linear-integration (c23d14d7, 3f1354e9, eb2c5bcf). Verified by 1561 vitest tests and a live check against the Linear API.
---
Query/mutation strings and a zod schema per operation so malformed responses fail with the operation name, not a deep property error. Operations: viewer, team states+labels, issues by ids, issues by updatedAt filter, issueCreate, issueUpdate, attachmentCreate, commentCreate, commentResolve, issueLabelCreate. Spec Component 8.
