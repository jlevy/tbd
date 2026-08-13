---
type: is
id: is-01kzyh1y801793wy1w75spxh8j
title: sync-engine reports a push that did not happen when spliceDescription is a no-op
kind: bug
status: in_progress
priority: 3
version: 3
labels: []
dependencies: []
parent_id: is-01kzymcx5gjwfra1z0s3rz1g05
created_at: 2026-08-13T21:39:35.808Z
updated_at: 2026-08-13T22:41:46.553Z
---
sync-engine.ts:1109-1118: when managedBlock is set but adapter.spliceDescription returns null (the remote description is already correct -- reachable when the remote changes between plan and write), report.pushed.push(displayId) still runs. The dry-run path and the live path then disagree about whether a push occurred.

Fix: push the display id only when result is non-null, or when hasExternalPatch is true.

## Notes

Source: GitHub PR #212 formal review 4931891999. Address via fixed, rebutted, or deferred disposition map.
