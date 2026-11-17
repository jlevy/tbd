---
type: is
id: is-01m7khcxc64qatcb9jqd5rass0
title: "PR #332 D4: Tell Codex users to re-trust tbd hooks after setup changes their commands"
kind: bug
status: in_progress
priority: 2
version: 2
delegate: claude-code@vm
labels: []
dependencies: []
hold: null
hold_until: null
created_at: 2026-11-17T01:19:31.206Z
updated_at: 2026-11-17T01:19:50.140Z
started_at: 2026-11-17T01:19:50.139Z
---
Review D (Medium). Codex skips a new or changed hook until the user reviews it in /hooks. Setup rewrites all four Codex commands (packages/tbd/src/cli/commands/setup.ts:953-959) and says nothing. Fix: print one line when setup replaces a Codex hook command and add it to the changelog. Review: https://github.com/jlevy/tbd/pull/332#pullrequestreview-5930928560
