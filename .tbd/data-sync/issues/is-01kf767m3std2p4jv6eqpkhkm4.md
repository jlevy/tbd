---
type: is
id: is-01kf767m3std2p4jv6eqpkhkm4
title: Add Git 2.42+ version check
kind: task
status: closed
priority: 1
version: 8
labels: []
dependencies: []
created_at: 2026-01-17T23:56:46.584Z
updated_at: 2026-03-09T16:12:31.244Z
closed_at: 2026-01-18T01:05:28.603Z
close_reason: Implemented Git 2.42+ version check with graceful upgrade instructions. Added checks to init command (fails with clear error) and doctor command (shows version status). The check is already present in git.ts - updated to use 'required' instead of 'recommended' and integrated it into user-facing commands.
---
Requires Git 2.42+ for --orphan worktree. Fail gracefully with upgrade instructions.
