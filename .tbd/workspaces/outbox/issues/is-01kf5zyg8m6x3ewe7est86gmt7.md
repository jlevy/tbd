---
close_reason: Implemented in commit 11fbe51
closed_at: 2026-01-17T01:34:03.040Z
created_at: 2026-01-16T07:09:58.491Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.266Z
    original_id: tbd-1819
id: is-01kf5zyg8m6x3ewe7est86gmt7
kind: feature
labels: []
parent_id: null
priority: 2
status: closed
title: "Feature: Add tbd uninstall command to completely remove installation"
type: is
updated_at: 2026-03-09T02:47:21.015Z
version: 5
---
Add a 'tbd uninstall' command that completely removes the tbd installation from a repository. Should: (1) Delete .tbd/ directory with config and worktree, (2) Delete tbd-sync branch (local and optionally remote with --remote flag), (3) Delete .tbd-sync/ directory if it exists on main, (4) Warn and require confirmation unless --yes flag provided. **IMPORTANT: Help text and confirmation prompt must warn about FULL DATA LOSS - all issues will be permanently deleted.** Useful for: testing, switching away from tbd, and round-trip golden tests (import, operate, uninstall, repeat).
