---
type: is
id: is-01m7kkccjj6f91kmgpk43bna6j
title: "PR #332 D5: commandWindows override for Codex hooks on native Windows"
kind: feature
status: open
priority: 3
version: 1
labels: []
dependencies: []
created_at: 2026-11-17T01:54:11.153Z
updated_at: 2026-11-17T01:54:11.153Z
---
Review D (D5), owner decision: scope native Windows out for now; tbd-design.md 6.4.2 states that tbd's generated Codex hooks need a POSIX shell with bash on PATH. Follow-up: Codex starts hook commands on Windows with %COMSPEC% /C, and cmd.exe parses the bash -c wrapper's &&, ||, and >&2 itself. Add a commandWindows value to each generated Codex handler (documented by Codex as a Windows-only command override) that cmd.exe can run, once someone can test Codex on native Windows. Review: https://github.com/jlevy/tbd/pull/332#pullrequestreview-5930928560
