---
type: is
id: is-01m7khczk494q8ke1er9ncz6kf
title: "PR #332 D5: Decide Codex on native Windows for the bash -c hook wrappers"
kind: task
status: open
priority: 2
version: 1
labels: []
dependencies: []
created_at: 2026-11-17T01:19:33.476Z
updated_at: 2026-11-17T01:19:33.476Z
---
Review D (Medium, not reproduced), owner decision. Codex starts hook commands on Windows with %COMSPEC% /C, which does not treat ' as a quote, so the wrapper's &&, ||, >&2 are parsed by cmd.exe. Options: add a commandWindows override per generated handler, or state in tbd-design.md 6.4.2 that tbd's Codex hooks need a POSIX shell. Verify on Windows. Review: https://github.com/jlevy/tbd/pull/332#pullrequestreview-5930928560
