---
type: is
id: is-01m7khcy4hmrz69b9kt9xgb5fr
title: "PR #332 D8: Docs say a compound hook command stays the user's, but Claude setup replaces it"
kind: bug
status: in_progress
priority: 3
version: 3
delegate: claude-code@vm
labels: []
dependencies: []
hold: null
hold_until: null
created_at: 2026-11-17T01:19:31.984Z
updated_at: 2026-11-17T02:24:43.524Z
started_at: 2026-11-17T01:19:50.774Z
---
Review D (Low). hook-commands.ts:22-23 and tbd-design.md:5622-5623 say a command that adds anything else stays the user's own; mergeClaudeTbdHookEvent (setup.ts:765) replaces any Claude handler naming tbd's script. Fix: correct both texts; behavior unchanged. Review: https://github.com/jlevy/tbd/pull/332#pullrequestreview-5930928560

## Notes

D8 cherry-picked to side branch claude/harden-hook-launchers-owner-decisions (local in scratchpad/tbd-332-side, on 09285a72; not yet pushed: the push was denied by the permission system) as 9de8305c. Owning session closes this bead.
