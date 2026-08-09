---
type: is
id: is-01kyt901487pe7wnvne7f92pmq
title: "Ratchet: re-enable @typescript-eslint/no-unnecessary-condition"
kind: chore
status: open
priority: 2
version: 1
labels: []
dependencies: []
created_at: 2026-07-30T19:46:05.064Z
updated_at: 2026-07-30T19:46:05.064Z
---
eslint.config.js disables no-unnecessary-condition because existing violations predate the strictTypeChecked floor (adopted for PR #199 review R3). Clear the violation backlog, then delete the off-switch in eslint.config.js so the rule enforces at error. Until then the strict preset runs with this one hole.
