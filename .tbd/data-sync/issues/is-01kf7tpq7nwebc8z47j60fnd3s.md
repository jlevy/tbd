---
type: is
id: is-01kf7tpq7nwebc8z47j60fnd3s
title: Remove redundant STATUS header from doctor
kind: task
status: closed
priority: 2
version: 9
labels: []
dependencies:
  - type: blocks
    target: is-01kf7tpcphaa1m10fbxhd86jxr
  - type: blocks
    target: is-01kf7trcmgzzv5245824gbcat3
created_at: 2026-01-18T05:54:32.820Z
updated_at: 2026-03-09T16:12:31.712Z
closed_at: 2026-01-18T06:20:37.549Z
close_reason: Renamed STATUS to REPOSITORY in doctor for consistency - both commands now use same section structure
---
Doctor duplicates the status output under a STATUS header. Remove the header since the version line is sufficient.
