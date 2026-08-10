---
type: is
id: is-01kzn50x091m9cpn9qyhmd5r5d
title: parent_id cycle and depth validation
kind: task
status: closed
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies: []
parent_id: is-01kzn2w9gdhb0xt2hztn7v0aha
created_at: 2026-08-10T06:16:08.968Z
updated_at: 2026-08-10T17:35:53.882Z
closed_at: 2026-08-10T17:35:53.882Z
close_reason: Implemented in claude/linear-integration (c23d14d7, 3f1354e9, eb2c5bcf). Verified by 1561 vitest tests and a live check against the Linear API.
---
There is no cycle or depth validation on parent_id today. A parent cycle would hang tree rendering (bead-web buildTree/withAncestors) and cause unbounded recursion in any mirror that walks ancestors. Add validation on create/update, plus a doctor check for existing cycles. Required before nested epics mirror. Spec Component 6.
