---
type: is
id: is-01m00hf31fn9wskcxd775x8xaa
title: Push the sync branch with --no-verify so tbd sync stops running the parent repo's pre-push hook
kind: bug
status: open
priority: 1
version: 2
labels:
  - sync-efficiency
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-14T16:25:15.567Z
updated_at: 2026-08-14T16:40:23.379Z
---
tbd deliberately passes --no-verify on its commits to the sync branch so parent-repo hooks (lefthook, husky) do not fire on bead bookkeeping — git.ts:1722 states that intent directly. pushWithRetry does not do the same: it issues a plain 'git push <remote> refs/heads/tbd-sync:refs/heads/tbd-sync' (git.ts:1029), which fires .git/hooks/pre-push.

In this repository that hook is lefthook's pre-push: quality gate, build, and the full vitest suite. Observed 2026-08-14: a tbd sync that wrote 19 bead files committed in under a second, then sat for minutes in 'pnpm test' invoked from the sync-branch push. The retry loop re-pushes up to MAX_PUSH_RETRIES times on a non-fast-forward, so a contended sync can pay for the suite repeatedly.

This is the single largest obstacle to syncing frequently, and it is an inconsistency rather than a design decision. The sync branch carries no source code, so no parent-repo pre-push gate has anything to say about it.

Research: research-2026-08-14-agent-sync-protocol-and-hooks.md F5, §3.3
