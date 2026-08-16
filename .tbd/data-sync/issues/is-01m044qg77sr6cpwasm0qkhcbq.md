---
type: is
id: is-01m044qg77sr6cpwasm0qkhcbq
title: Two goldens invert when 0.7.0 ships, and will 'break' on success
kind: task
status: open
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - phase-4
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-16T01:59:37.390Z
updated_at: 2026-08-16T02:10:12.659Z
extensions:
  linear:
    id: e4fe7e8d-63cc-4b9b-8485-a712bc5175dc
    linked_at: 2026-08-16T02:10:12.659Z
---
Both are correct today and become wrong the moment a published release can read f08:

1. `tbd doctor` emits a 'Launcher fallback' warning because tbd_fallback_version (0.6.5) cannot read f08. The warning disappears once the tagged version can, and its golden must drop the line.
2. scripts/validate-upgrade-package.mjs has no same-format baseline — deliberately, since no published version produces f08. Add 0.7.0 as the expectOldClientToWork: true scenario once it exists.

Recorded so these read as scheduled work rather than a surprise regression during the release.
