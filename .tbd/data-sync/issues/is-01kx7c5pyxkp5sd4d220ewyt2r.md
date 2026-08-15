---
type: is
id: is-01kx7c5pyxkp5sd4d220ewyt2r
title: "Commit regenerated agent hook scripts after #188 hook-template hardening"
kind: task
status: closed
priority: 3
version: 2
labels: []
dependencies: []
created_at: 2026-07-11T01:20:20.956Z
updated_at: 2026-08-15T05:36:50.970Z
closed_at: 2026-08-15T05:36:50.969Z
close_reason: "Completed/superseded: the repository's generated hook and session surfaces have been refreshed repeatedly since PR #188 and current main contains the hardened launchers."
---
PR #188 hardened the hook templates in setup.ts (bash invocation, git rev-parse root resolution, pinned npx fallback, replace-not-skip on setup --auto). This repo's own checked-in dogfood installs (.claude/hooks/tbd-closing-reminder.sh, .claude/scripts/tbd-session.sh, .codex/*) regenerate with the new content on any tbd setup --auto run and show as uncommitted drift until someone commits the regenerated files. Run tbd setup --auto on a clean main checkout and commit the diff.
