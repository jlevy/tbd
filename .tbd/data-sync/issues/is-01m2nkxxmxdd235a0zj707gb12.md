---
type: is
id: is-01m2nkxxmxdd235a0zj707gb12
title: "PR #301 review R3: diff existing PRs from fetched remote base"
kind: bug
status: closed
priority: 2
version: 3
delegate: codex@spud10
labels: []
dependencies: []
parent_id: is-01m2nkxetrqprhrk8vsh7q9avn
hold: null
hold_until: null
created_at: 2026-09-16T17:23:45.436Z
updated_at: 2026-09-16T17:43:50.521Z
started_at: 2026-09-16T17:24:38.685Z
closed_at: 2026-09-16T17:43:50.521Z
close_reason: "Fixed in 5fbd858b: hardened stack sync postconditions, remote checkout conflict preflight, remote-base diff selection, and PR shortcut routing"
resolution: null
duplicate_of: null
---
Medium finding at packages/tbd/docs/shortcuts/standard/create-or-update-pr-simple.md:79 and the validation-plan variant. Prefer fetched remote refs for existing PR/trunk diffs; reserve local bases for unpublished local stack layers; add regression coverage. Review: https://github.com/jlevy/tbd/pull/301#issuecomment-5701658210
