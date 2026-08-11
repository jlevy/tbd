---
type: is
id: is-01kzs9hy1f971yzj995exw09gd
title: Mark truncated web boards as command-inexact
kind: bug
status: closed
priority: 2
version: 5
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
  - correctness
  - pr-207
dependencies: []
parent_id: is-01kzs5fg2amah8bnpy3mct8khd
created_at: 2026-08-11T20:52:19.118Z
updated_at: 2026-08-11T21:05:48.479Z
closed_at: 2026-08-11T21:05:48.478Z
close_reason: R18 fixed, regression-tested, replied to, and resolved on the green final PR head.
---
Cursor Bugbot thread PRRT_kwDOQ109P86YXq_0 found that BoardState.buildBoardResponse can filter contextIds to zero after the 10k slice while commandExact still ignores truncation. The UI may then claim the displayed table is reproducible by the CLI even though the CLI returns additional rows. Make every truncated response command-inexact, add an explicit truncation caveat in core.ts so the tooltip remains actionable, cover both server and pure-client seams, reply to and resolve the PR thread.

## Notes

Implemented and verified in 50f895fb. BoardState.buildBoardResponse requires truncated === 0 for commandExact; caveatsFor names the returned-prefix bound. The 10,001-issue regression and pure core helper coverage pass. PR reply 3761673678 is posted and thread PRRT_kwDOQ109P86YXq_0 is resolved. Exact-tree CI passes 110 files / 1,503 tests; hosted run 31535582219 is green.
