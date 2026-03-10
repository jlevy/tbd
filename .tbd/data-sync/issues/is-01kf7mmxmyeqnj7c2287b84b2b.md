---
type: is
id: is-01kf7mmxmyeqnj7c2287b84b2b
title: Debug mode git log output
kind: task
status: closed
priority: 2
version: 10
labels: []
dependencies:
  - type: blocks
    target: is-01kf7mmy2wq0qgmaxj55vtsvsc
created_at: 2026-01-18T04:08:42.397Z
updated_at: 2026-03-09T16:12:31.612Z
closed_at: 2026-01-18T05:46:15.152Z
close_reason: Implemented showGitLogDebug helper in sync.ts - shows git log --stat after push/pull in debug mode
---
Show git log --stat in debug mode after sync:
- After push: git log --stat origin/tbd-sync@{1}..origin/tbd-sync
- After pull: git log --stat HEAD@{1}..HEAD

Format:
[debug] Commits synced:
commit ee88823... (origin/tbd-sync, tbd-sync)
    tbd sync: 2026-01-17T23-50-56 (1 file)
 .tbd/data-sync/issues/is-01kf5...md | 8 ++++----
 1 file changed, 4 insertions(+), 4 deletions(-)

Reference: plan spec section 2.9 (Debug mode git log)
