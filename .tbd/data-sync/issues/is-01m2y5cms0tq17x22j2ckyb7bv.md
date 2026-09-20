---
type: is
id: is-01m2y5cms0tq17x22j2ckyb7bv
title: "PR #309 J2: Fail setup when a selected tier-agent surface fails"
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
created_at: 2026-09-20T01:02:49.118Z
updated_at: 2026-09-20T01:41:42.621Z
started_at: 2026-09-20T01:41:42.621Z
---
Review J. installTierAgentSurface catches filesystem errors and setup exits zero/All set without requested agents. Propagate honest failure and cover Claude/Codex paths.
