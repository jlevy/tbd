---
type: is
id: is-01kytpdeb2fjm2xm8raczqmj20
title: tbd sync issues phase hangs in proxied remote session; killed sync leaves stale lock that silently blocks all issue writes
kind: bug
status: open
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-28-sync-convergence-and-stability.md
labels: []
dependencies: []
created_at: 2026-07-30T23:40:36.066Z
updated_at: 2026-08-28T19:55:34.055Z
---
Two coupled failure modes observed in a CCR remote container (git origin via local proxy, session HTTPS proxy intercepting GitHub API, use_gh_cli: true), session for GH issue #195 / PR #201, 2026-07-30 ~23:00Z, CLI resolved to local dev build 0.4.2-dev.23:

(1) ORIGINAL HANG (root cause unconfirmed): 'tbd sync --issues' exported and committed the pending issue change into .git/tbd/data-sync-worktree (commit landed), stamped last_doc_sync_at for the docs phase, then hung >2min with no output and was SIGTERMed. The issues phase never completed and last_sync_at never advanced. A manual 'git push origin tbd-sync:tbd-sync' from the data-sync-worktree afterwards succeeded in ~1s with no prompt and no branch restriction, so the push itself was not the blocker. NO_PROXY bypass for the 7 GitHub hosts did not help. Suspects: a gh CLI subprocess stalling through the session proxy (use_gh_cli: true), a swallowed interactive prompt in a non-TTY, or the escape-branch path (origin has a stale claude/tbd-sync-szKzG branch from an earlier session).

(2) CONFIRMED CONSEQUENCE: the SIGTERMed sync left .git/tbd/locks/data-sync.lock (mkdir-style lock dir) behind. Every subsequent issues-path command - 'tbd sync --issues --push', 'tbd sync ... --dry-run', even 'tbd create' - blocked INDEFINITELY and SILENTLY on that stale lock: no message naming the lock, no staleness detection, no timeout. Read paths (show, --help) were unaffected. Removing the lock dir restored normal operation immediately.

Fix directions: (a) lock acquisition should print what it is waiting on after ~2s and detect staleness (dead pid / age heuristic) instead of blocking forever - this turns any future hang from a mystery into a one-line diagnosis; (b) run sync git/gh subprocesses with GIT_TERMINAL_PROMPT=0, GIT_ASKPASS=/bin/true and GH_PROMPT_DISABLED, plus per-subprocess timeouts that fail loud; (c) dry-run should not need the write lock. Workaround if hit again: kill the hung command, rmdir .git/tbd/locks/data-sync.lock, and if an unpushed sync commit exists push tbd-sync manually from .git/tbd/data-sync-worktree.
