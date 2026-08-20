---
type: is
id: is-01m0e7zs1r94ghq727jrsw56g9
title: "PR #249 review R1: unignored local .env unflagged when credential resolves from main worktree"
kind: bug
status: closed
priority: 1
version: 3
labels: []
dependencies: []
parent_id: is-01m0e7zrm2r5fj2a1cpwax42w9
created_at: 2026-08-20T00:08:58.679Z
updated_at: 2026-08-20T00:22:13.870Z
closed_at: 2026-08-20T00:22:13.859Z
close_reason: null
---
envFileFinding (packages/tbd/src/integrations/core/status.ts:85-116) checks only dirname(loadedFrom) when the external path is set (integrationStatus, status.ts:229-231), so a worktree-local .env that exists but is not gitignored is never examined once another provider's credential resolves from the main worktree. Regression: before PR #249 the local file was always checked. Fix: evaluate both files, report the more severe finding, name the file (path suffix and remedy directory) whenever the external branch is active. Add regression test: local unignored .env lacking the key + main-resolved credential → error naming the local path.
