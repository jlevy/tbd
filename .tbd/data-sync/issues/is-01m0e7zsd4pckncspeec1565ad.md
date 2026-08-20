---
type: is
id: is-01m0e7zsd4pckncspeec1565ad
title: "PR #249 review R2: memoize resolveMainWorktree per baseDir"
kind: task
status: closed
priority: 2
version: 2
labels: []
dependencies: []
parent_id: is-01m0e7zrm2r5fj2a1cpwax42w9
created_at: 2026-08-20T00:08:59.043Z
updated_at: 2026-08-20T00:22:14.141Z
closed_at: 2026-08-20T00:22:14.140Z
close_reason: null
---
resolveMainWorktree (packages/tbd/src/lib/paths.ts) runs 3-4 git spawns and is called once per provider via resolveCredential (5 call sites; integrationStatus loops providers). Memoize per baseDir at module level; topology cannot change within a one-shot CLI process, and env-file content is still read fresh each time.
