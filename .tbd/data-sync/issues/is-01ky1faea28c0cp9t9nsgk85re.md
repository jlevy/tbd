---
type: is
id: is-01ky1faea28c0cp9t9nsgk85re
title: "PR #196 review R2: interrupted watch orphans private refs"
kind: bug
status: closed
priority: 1
version: 3
labels:
  - pr196-review
dependencies: []
parent_id: is-01ky1f9xcbb3qas6ex5v7hda0k
created_at: 2026-07-21T04:35:36.898Z
updated_at: 2026-07-21T04:48:28.733Z
closed_at: 2026-07-21T04:48:28.732Z
close_reason: "Fixed in 52867bd: sweepStaleWatchRefs deletes refs/tbd/watch/* whose embedded pid is dead, called at watch startup; CHANGELOG reworded. Test covers dead/live/unrecognized refs."
---
SIGINT skips the finally cleanup, so any watch that fetched leaves refs/tbd/watch/<pid>-<uuid> behind, pinning objects against GC, unbounded accumulation. bead-watch.ts:52,100-107. Fix: best-effort startup sweep deleting refs/tbd/watch/* whose embedded PID is dead (process.kill(pid,0)); reword CHANGELOG 'finally path' claim to 'on normal exit, with stale refs swept by later watches'.
