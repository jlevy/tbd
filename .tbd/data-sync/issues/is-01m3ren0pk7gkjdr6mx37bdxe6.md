---
type: is
id: is-01m3ren0pk7gkjdr6mx37bdxe6
title: Preserve unrelated Codex hook entries and refuse unsafe hooks targets
kind: bug
status: in_progress
priority: 1
version: 3
delegate: claude-code@spud10.local
labels: []
dependencies:
  - type: blocks
    target: is-01m3rkx8y1t5z3kbnxjsc89nqf
hold: null
hold_until: null
created_at: 2026-09-30T06:04:55.890Z
updated_at: 2026-09-30T07:40:06.831Z
started_at: 2026-09-30T07:40:06.456Z
---
Pre-existing at stack base a92ecab9, found while reviewing #309. setup.ts inspect/installCodexHooks treats any .codex/ command as tbd-owned, removes whole mixed entries, treats malformed JSON as missing, and lacks the target checks applied to Claude surfaces. Bound fix: exact generated-command ownership, preserve unrelated hooks even in mixed entries, reject malformed/non-regular/linked targets before writes; add CLI preservation/refusal regressions. Track independently of review N6 dead-handler cleanup.
