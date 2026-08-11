---
type: is
id: is-01kzs9hy1f971yzj995exw09gd
title: Mark truncated web boards as command-inexact
kind: bug
status: in_progress
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
  - correctness
  - pr-207
dependencies: []
parent_id: is-01kzs5fg2amah8bnpy3mct8khd
created_at: 2026-08-11T20:52:19.118Z
updated_at: 2026-08-11T20:54:01.231Z
---
Cursor Bugbot thread PRRT_kwDOQ109P86YXq_0 found that BoardState.buildBoardResponse can filter contextIds to zero after the 10k slice while commandExact still ignores truncation. The UI may then claim the displayed table is reproducible by the CLI even though the CLI returns additional rows. Make every truncated response command-inexact, add an explicit truncation caveat in core.ts so the tooltip remains actionable, cover both server and pure-client seams, reply to and resolve the PR thread.

## Notes

Implemented at the two reported seams. BoardState.buildBoardResponse now computes truncated once and requires truncated === 0 for commandExact. caveatsFor names the returned-prefix bound so the client tooltip remains actionable when no other caveat applies. The 10,001-issue performance regression now asserts commandExact=false, and the pure helper test asserts the truncation caveat. Focused web-core/performance tests (18/18), strict typecheck, format/lint hooks, and packed-web proof pass. Awaiting pushed-head CI, thread reply/resolution, and final audit.
