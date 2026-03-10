---
type: is
id: is-01kgc761hxdbctw6jgqgy9fjxp
title: Add test for merge conflict detection in sync
kind: task
status: closed
priority: 1
version: 8
labels: []
dependencies: []
parent_id: is-01kgc6hsmxfbrsts7q2mmjrznp
created_at: 2026-02-01T09:05:17.371Z
updated_at: 2026-03-09T16:12:33.665Z
closed_at: 2026-02-01T09:14:25.543Z
close_reason: Added unit tests for mergeIdMappings and parseIdMappingFromYaml functions
---
Test the safety check that prevents committing files with merge conflict markers.

Test scenario:
1. Set up two repos (local and remote) with tbd initialized
2. Create issue on local, sync
3. Create different issue on remote directly in worktree, commit
4. Create another issue on local (so ids.yml diverges)
5. Run sync - should detect the conflict in ids.yml
6. Verify SyncError is thrown with the conflicted file names

This tests the safety check. A separate test should verify proper resolution once tbd-1orc is fixed.
