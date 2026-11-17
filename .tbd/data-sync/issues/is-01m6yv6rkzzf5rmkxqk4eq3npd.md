---
type: is
id: is-01m6yv6rkzzf5rmkxqk4eq3npd
title: "PR #332 A3: closing hook exits 1 silently when node fails"
kind: bug
status: closed
priority: 3
version: 2
labels: []
dependencies: []
parent_id: is-01m6yv6qega7ts908s41sm9pqm
created_at: 2026-11-09T00:26:52.415Z
updated_at: 2026-11-09T00:41:15.319Z
closed_at: 2026-11-09T00:41:15.318Z
close_reason: "Fixed in 842ef29e on PR #332; disposition reply posted"
resolution: null
duplicate_of: null
---
Low. Generated tbd-closing-reminder.sh tbd_detect_git_push prints nothing when node -e fails without output. Review: https://github.com/jlevy/tbd/pull/332#pullrequestreview-5820355604
