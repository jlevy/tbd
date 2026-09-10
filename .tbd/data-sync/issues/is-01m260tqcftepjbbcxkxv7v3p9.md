---
type: is
id: is-01m260tqcftepjbbcxkxv7v3p9
title: tbd sync rewrites tracked docs-cache config while reporting already in sync
kind: bug
status: open
priority: 2
version: 1
labels: []
dependencies: []
created_at: 2026-09-10T16:01:21.294Z
updated_at: 2026-09-10T16:01:21.294Z
---
Reproduced on PR #283 exact head 9794b8b0 during landing. Running tbd sync reports 'Already in sync' but rewrites .tbd/config.yml: it removes shortcuts/standard/stacked-prs.md, removes then re-inserts guidelines/scripts/check-rust-gate.mjs at a different position, and leaves the code worktree dirty. The mutation blocks the required git pull --rebase until manually restored. Determine whether generated docs-cache entries are stale, whether sync should update them, and make the operation deterministic and honest: either preserve an already-valid tracked config or explicitly report and own the intended update. Add a regression covering an otherwise-clean worktree and repeated tbd sync.
