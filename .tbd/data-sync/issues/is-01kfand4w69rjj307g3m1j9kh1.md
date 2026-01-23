---
close_reason: "Fixed: setupClaudeIfDetected, setupCursorIfDetected, setupCodexIfDetected now always run handlers to update skill/rules files even when already installed"
closed_at: 2026-01-23T02:56:01.317Z
created_at: 2026-01-19T08:19:39.508Z
dependencies:
  - target: is-01kf7j53z1gahrqswh8x4v4b6t
    type: blocks
id: is-01kfand4w69rjj307g3m1j9kh1
kind: bug
labels: []
priority: 1
status: closed
title: tbd setup auto should update skill files, not skip them
type: is
updated_at: 2026-01-23T02:56:01.318Z
version: 5
---
## Problem

`tbd setup auto` is idempotent and skips updating files when they already exist. This means if the source SKILL.md is updated, existing installations don't get the new content.

In `setupClaudeIfDetected` (setup.ts:1514-1565):
- Checks if hook exists AND skill file exists
- If both true, returns early without calling the handler
- The skill file never gets updated

Same pattern in `setupCursorIfDetected` and `setupCodexIfDetected`.

## Expected Behavior

`tbd setup auto` should always update content files (SKILL.md, tbd.mdc, AGENTS.md section) to ensure users have the latest instructions, even if the integration was previously installed.

## Fix

Remove the early returns in the auto setup handlers. Always call the underlying handlers (`SetupClaudeHandler`, `SetupCursorHandler`, `SetupCodexHandler`) which already handle existing files correctly by overwriting/updating with the latest content.

## Files to Change

- packages/tbd/src/cli/commands/setup.ts
  - `setupClaudeIfDetected`: Remove early return at lines 1548-1552
  - `setupCursorIfDetected`: Remove early return at lines 1585-1589  
  - `setupCodexIfDetected`: Remove early return at lines 1623-1628
