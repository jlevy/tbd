---
type: is
id: is-01m2nkxy0qavm1e55zvajwwhb2
title: "PR #301 review R4: scope compact PR routing to creation"
kind: bug
status: open
priority: 2
version: 1
labels: []
dependencies: []
parent_id: is-01m2nkxetrqprhrk8vsh7q9avn
created_at: 2026-09-16T17:23:45.814Z
updated_at: 2026-09-16T17:23:45.814Z
---
Medium finding at packages/tbd/src/cli/commands/setup.ts:241. Narrow the generated AGENTS guidance so review, address-review, merge, and inspection requests are not routed into create-or-update-pr-simple; update setup coverage. Review: https://github.com/jlevy/tbd/pull/301#issuecomment-5701658210
