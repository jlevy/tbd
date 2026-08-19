---
type: is
id: is-01kzq7a7dq7sv27w9ndh32dpag
title: tbd list --defer-before is declared but never implemented
kind: bug
status: open
priority: 2
version: 1
labels:
  - cli
dependencies: []
created_at: 2026-08-11T01:34:40.566Z
updated_at: 2026-08-11T01:34:40.566Z
---
ListOptions declares deferBefore (--defer-before <date>, 'Deferred before date' in help) but filterIssues never reads it: the flag is a silent no-op. Found during the Phase 2 issue-query extraction, which preserves the no-op rather than silently changing behavior. Fix: implement (filter deferred_until < date) or remove the flag; either way add a transcript.
