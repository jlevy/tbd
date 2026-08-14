---
type: is
id: is-01kzyh1y801793wy1w75spxh8j
title: sync-engine reports a push that did not happen when spliceDescription is a no-op
kind: bug
status: closed
priority: 3
version: 4
labels: []
dependencies: []
parent_id: is-01kzymcx5gjwfra1z0s3rz1g05
created_at: 2026-08-13T21:39:35.808Z
updated_at: 2026-08-13T23:03:20.724Z
closed_at: 2026-08-13T23:03:20.724Z
close_reason: "Fixed in dcc136dd; full local CI and all PR #212 hosted checks passed."
---
sync-engine.ts:1109-1118: when managedBlock is set but adapter.spliceDescription returns null (the remote description is already correct -- reachable when the remote changes between plan and write), report.pushed.push(displayId) still runs. The dry-run path and the live path then disagree about whether a push occurred.

Fix: push the display id only when result is non-null, or when hasExternalPatch is true.

## Notes

Source: GitHub PR #212 formal review 4931891999. Address via fixed, rebutted, or deferred disposition map.
