---
type: is
id: is-01kzyh1y801793wy1w75spxh8j
title: sync-engine reports a push that did not happen when spliceDescription is a no-op
kind: bug
status: open
priority: 3
version: 1
labels: []
dependencies: []
created_at: 2026-08-13T21:39:35.808Z
updated_at: 2026-08-13T21:39:35.808Z
---
sync-engine.ts:1109-1118: when managedBlock is set but adapter.spliceDescription returns null (the remote description is already correct -- reachable when the remote changes between plan and write), report.pushed.push(displayId) still runs. The dry-run path and the live path then disagree about whether a push occurred.

Fix: push the display id only when result is non-null, or when hasExternalPatch is true.
