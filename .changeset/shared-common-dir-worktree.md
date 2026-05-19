---
"get-tbd": minor
---
Move the local tbd sync worktree into the Git common directory so the main checkout and
linked worktrees share one `tbd-sync` worktree.
This adds the `f04` local layout format, `sync.storage: git-common-dir-v1`, common-dir
layout metadata, shared locking, legacy per-checkout worktree migration, and clearer
upgrade errors when a repository requires a newer tbd version.

Upgrade note: after this release writes `tbd_format: f04` to `.tbd/config.yml`, older
tbd clients (pre-f04) on the same repository will fail closed with a “newer tbd version”
error rather than silently rewriting the legacy per-checkout layout.
Run `npm install -g get-tbd@latest` on every machine that touches the repo.
