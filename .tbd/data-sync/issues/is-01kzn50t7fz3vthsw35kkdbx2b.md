---
type: is
id: is-01kzn50t7fz3vthsw35kkdbx2b
title: "integrations/linear/queries.ts: operations + zod response schemas"
kind: task
status: open
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzn50tnf2yx0ndsgpfqw91mb
parent_id: is-01kzn2w8x0c038fhk1c859248r
created_at: 2026-08-10T06:16:06.126Z
updated_at: 2026-08-10T06:16:06.574Z
---
Query/mutation strings and a zod schema per operation so malformed responses fail with the operation name, not a deep property error. Operations: viewer, team states+labels, issues by ids, issues by updatedAt filter, issueCreate, issueUpdate, attachmentCreate, commentCreate, commentResolve, issueLabelCreate. Spec Component 8.
