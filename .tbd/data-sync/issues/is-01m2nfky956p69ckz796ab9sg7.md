---
type: is
id: is-01m2nfky956p69ckz796ab9sg7
title: Review external gh-stack skill before persistent installation
kind: task
status: open
priority: 2
version: 1
labels:
  - stacked-prs
  - security
dependencies: []
created_at: 2026-09-16T16:08:24.100Z
updated_at: 2026-09-16T16:08:24.100Z
---
The opt-in ensure-gh-cli script installs the pinned external gh-stack agent skill at user scope, then warns that GitHub does not verify skills and suggests review. Decide and implement a workflow that exposes the pinned skill for review before persistent installation without making automated setup hang or silently trust external instructions.
