---
"get-tbd": minor
---
Move the local tbd sync worktree into the Git common directory so the main checkout and
linked worktrees share one `tbd-sync` worktree.
This adds the `f04` local layout format, `sync.storage: git-common-dir-v1`, common-dir
layout metadata, shared locking, and legacy per-checkout worktree migration.
