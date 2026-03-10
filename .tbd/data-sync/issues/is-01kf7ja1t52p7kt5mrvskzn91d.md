---
type: is
id: is-01kf7ja1t52p7kt5mrvskzn91d
title: Fix --parent option storing public ID instead of internal ID
kind: bug
status: closed
priority: 1
version: 8
labels: []
dependencies: []
created_at: 2026-01-18T03:27:49.060Z
updated_at: 2026-03-09T16:12:31.486Z
closed_at: 2026-01-18T04:05:22.563Z
close_reason: "Fixed: create and update now resolve display IDs to internal IDs using resolveToInternalId"
---
When using `tbd update --parent tbd-xxx` or `tbd create --parent tbd-xxx`, the CLI stores the public ID in the parent_id field instead of converting it to the internal ID. This causes ZodError validation failures when listing/reading issues because the parent_id schema expects an internal ID format (is-*) not a public ID format (tbd-*).
