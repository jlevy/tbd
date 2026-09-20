---
type: is
id: is-01m2tn5jdzk064ec1k32q16ct3
title: doctor reports generated skills stale when the .tbd/docs cache is empty
kind: bug
status: in_progress
priority: 2
version: 2
delegate: codex@spud10
labels: []
dependencies: []
hold: null
hold_until: null
created_at: 2026-09-18T16:21:36.831Z
updated_at: 2026-09-20T06:30:39.032Z
started_at: 2026-09-20T06:30:39.032Z
---
Review G's G5 (https://github.com/jlevy/tbd/pull/309), pre-existing, outside that PR's diff. In a fresh clone or git worktree .tbd/docs is empty (gitignored), so generateShortcutDirectory composes a shorter SHORTCUT DIRECTORY and doctor marks both SKILL.md surfaces stale even though the committed files match what a populated tree generates. It cost a reviewer real time: it looked like the D2 fix had not landed. Fix: warm the doc cache before the comparison (setup already calls syncDocsWithDefaults), or report 'freshness unknown: doc cache not populated' the way checkCodexAgents already does for an unreadable policy block. doctor.ts:1046 via doc-cache.ts:598.
