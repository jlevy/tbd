---
type: is
id: is-01m2y5cpcv8bzxybt7x0qzcs86
title: "PR #309 J4: Make merge gate valid for atomic formal stacks"
kind: bug
status: in_progress
priority: 2
version: 2
delegate: codex@spud10
labels: []
dependencies: []
parent_id: is-01m2y4ygvt317renehn2caprwa
hold: null
hold_until: null
created_at: 2026-09-20T01:02:50.778Z
updated_at: 2026-09-20T01:07:19.374Z
started_at: 2026-09-20T01:07:19.374Z
---
Review J. Step 5 requires lower layers already merged but step 6 requires whole stack gated before atomic merge. Gate included layers and validate chain; pass chosen merge method.
