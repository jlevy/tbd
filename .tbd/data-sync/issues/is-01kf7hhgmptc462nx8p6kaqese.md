---
type: is
id: is-01kf7hhgmptc462nx8p6kaqese
title: Enhance tbd stats with ready/open counts
kind: task
status: closed
priority: 1
version: 11
labels: []
dependencies:
  - type: blocks
    target: is-01kf7hhy9hqk0ht4h4yr31hvzy
  - type: blocks
    target: is-01kf7hgnt5ymykg47yvryr2dj7
created_at: 2026-01-18T03:14:25.045Z
updated_at: 2026-03-09T16:12:31.414Z
closed_at: 2026-01-18T05:44:03.137Z
close_reason: Added ready/blocked counts and Summary section to stats command
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
