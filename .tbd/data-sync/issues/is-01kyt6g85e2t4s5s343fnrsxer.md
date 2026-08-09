---
type: is
id: is-01kyt6g85e2t4s5s343fnrsxer
title: "PR #199 review R7: Serialize repo autofix hooks and verify at push"
kind: bug
status: open
priority: 2
version: 1
labels: []
dependencies: []
parent_id: is-01kyt5yg0s4vkbqyq8n0aa8y4d
created_at: 2026-07-30T19:02:30.829Z
updated_at: 2026-07-30T19:02:30.829Z
---
R7 Medium. lefthook.yml:6-75 uses parallel stage_fixed jobs and omits full quality verification at push. Serialize, use local pinned runners, add verify gate. Review: https://github.com/jlevy/tbd/pull/199#issuecomment-5135082477
