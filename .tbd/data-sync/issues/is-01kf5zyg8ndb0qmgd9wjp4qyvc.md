---
type: is
id: is-01kf5zyg8ndb0qmgd9wjp4qyvc
title: Replace custom atomicWriteFile with atomically library
kind: task
status: closed
priority: 2
version: 6
labels: []
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-16T21:36:50.819Z
updated_at: 2026-03-09T16:12:30.261Z
closed_at: 2026-01-16T21:52:56.516Z
close_reason: Replaced custom atomicWriteFile with atomically library. Also fixed dynamic imports in git.ts per typescript-rules.md.
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.517Z
    original_id: tbd-1853
---
Replace the custom atomicWriteFile implementation in storage.ts with the 'atomically' npm library. This aligns with our typescript-rules.md which already recommends using atomically. Benefits: TypeScript-native, zero dependencies, built-in error retry logic (EMFILE/ENFILE/EAGAIN/EBUSY/EACCESS/EPERM), concurrent write queueing for same path, symlink resolution. Changes needed: 1) Add atomically as dependency, 2) Replace custom function with re-export from atomically, 3) Keep same export name for backward compatibility.
