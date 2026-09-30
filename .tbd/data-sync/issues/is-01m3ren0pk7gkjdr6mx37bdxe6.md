---
type: is
id: is-01m3ren0pk7gkjdr6mx37bdxe6
title: Preserve unrelated Codex hook entries and refuse unsafe hooks targets
kind: bug
status: in_progress
priority: 1
version: 5
delegate: claude-code@spud10.local
labels: []
dependencies:
  - type: blocks
    target: is-01m3rkx8y1t5z3kbnxjsc89nqf
hold: null
hold_until: null
created_at: 2026-09-30T06:04:55.890Z
updated_at: 2026-09-30T08:19:39.128Z
started_at: 2026-09-30T07:40:06.456Z
---
Pre-existing at stack base a92ecab9, found while reviewing #309. setup.ts inspect/installCodexHooks treats any .codex/ command as tbd-owned, removes whole mixed entries, treats malformed JSON as missing, and lacks the target checks applied to Claude surfaces. Bound fix: exact generated-command ownership, preserve unrelated hooks even in mixed entries, reject malformed/non-regular/linked targets before writes; add CLI preservation/refusal regressions. Track independently of review N6 dead-handler cleanup.

## Notes

Implemented in PR #321 (https://github.com/jlevy/tbd/pull/321), formal stack #322 above README #313, head 72d0bf86a80e9c7d5e07335674e1b3a9fd07333d. Exact hook ownership, mixed-entry preservation and preflight refusal regressions pass. Full suite: 3,028 passed, 1 existing skip. Independent security review B found no remaining issue. Keep open until merge; final user review is pending.
