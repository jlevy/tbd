---
type: is
id: is-01kft9hdxsrstpfmyyxcerw3pt
title: Remove .tbd/docs from git tracking (now gitignored)
kind: task
status: closed
priority: 2
version: 7
labels:
  - chore
dependencies: []
created_at: 2026-01-25T10:00:07.864Z
updated_at: 2026-03-09T16:12:32.787Z
closed_at: 2026-01-25T10:00:37.006Z
close_reason: null
---
The .tbd/docs directory is now gitignored and regenerated on setup. Need to remove it from git tracking with 'git rm -r --cached .tbd/docs/' and commit the change.
