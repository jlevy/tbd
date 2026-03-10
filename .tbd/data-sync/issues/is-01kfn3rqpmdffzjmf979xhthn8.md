---
type: is
id: is-01kfn3rqpmdffzjmf979xhthn8
title: "Move built-in docs: guidelines and templates to top-level"
kind: task
status: closed
priority: 2
version: 7
labels: []
dependencies: []
parent_id: is-01kfn3qm96pv26s4bnntywy0ht
created_at: 2026-01-23T09:43:03.635Z
updated_at: 2026-03-09T16:12:32.483Z
closed_at: 2026-01-23T09:55:09.321Z
close_reason: Moved guidelines and templates to top-level docs directories
---
Move files in packages/tbd/docs/: shortcuts/guidelines/* -> guidelines/*, shortcuts/templates/* -> templates/*. Update copy-docs.mjs script to handle new structure. Update tsdown.config.ts if needed for build copying.
