---
type: is
id: is-01kf5zyg8m6x3ewe7est86gmt7
title: "Feature: Add tbd uninstall command to completely remove installation"
kind: feature
status: closed
priority: 2
version: 6
labels: []
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-16T07:09:58.491Z
updated_at: 2026-03-09T16:12:29.843Z
closed_at: 2026-01-17T01:34:03.040Z
close_reason: Implemented in commit 11fbe51
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.266Z
    original_id: tbd-1819
---
Add a 'tbd uninstall' command that completely removes the tbd installation from a repository. Should: (1) Delete .tbd/ directory with config and worktree, (2) Delete tbd-sync branch (local and optionally remote with --remote flag), (3) Delete .tbd-sync/ directory if it exists on main, (4) Warn and require confirmation unless --yes flag provided. **IMPORTANT: Help text and confirmation prompt must warn about FULL DATA LOSS - all issues will be permanently deleted.** Useful for: testing, switching away from tbd, and round-trip golden tests (import, operate, uninstall, repeat).
