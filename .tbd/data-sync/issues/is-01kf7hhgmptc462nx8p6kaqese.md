---
created_at: 2026-01-18T03:14:25.045Z
dependencies:
  - target: is-01kf7hhy9hqk0ht4h4yr31hvzy
    type: blocks
  - target: is-01kf7hgnt5ymykg47yvryr2dj7
    type: blocks
id: is-01kf7hhgmptc462nx8p6kaqese
kind: task
labels: []
priority: 1
status: in_progress
title: Enhance tbd stats with ready/open counts
type: is
updated_at: 2026-01-18T05:38:44.036Z
version: 5
---
Add the following counts to tbd stats (moved from tbd status):
- Ready count (issues with no blockers)
- In progress count
- Open count
- Blocked count

Keep existing breakdowns:
- By status (open, closed)
- By kind (bug, feature, task, epic, chore)
- By priority (0-4)

Add footer: 'Use tbd status for setup info, tbd doctor for health checks'
