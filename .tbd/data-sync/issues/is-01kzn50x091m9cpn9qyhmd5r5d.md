---
type: is
id: is-01kzn50x091m9cpn9qyhmd5r5d
title: parent_id cycle and depth validation
kind: task
status: open
priority: 1
version: 1
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies: []
parent_id: is-01kzn2w9gdhb0xt2hztn7v0aha
created_at: 2026-08-10T06:16:08.968Z
updated_at: 2026-08-10T06:16:08.968Z
---
There is no cycle or depth validation on parent_id today. A parent cycle would hang tree rendering (bead-web buildTree/withAncestors) and cause unbounded recursion in any mirror that walks ancestors. Add validation on create/update, plus a doctor check for existing cycles. Required before nested epics mirror. Spec Component 6.
