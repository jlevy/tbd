---
type: is
id: is-01kxbx4bv9h4zj4822mqj20bxw
title: pre-push test run stamps real .tbd/config.yml with dev tbd_version (isolation leak)
kind: bug
status: open
priority: 2
version: 1
labels: []
dependencies: []
created_at: 2026-07-12T19:33:40.329Z
updated_at: 2026-07-12T19:33:40.329Z
---
Observed twice in a Claude Code remote session on 2026-07-12 (ordinary checkout, not a linked worktree), while pushing docs commits from branch claude/tbd-v0.4.0-release-d3wwrx:

- During the lefthook pre-push `pnpm test` run (scrub-git-env.mjs in place, full suite green: 88 files / 1367 tests), the real repo's `.tbd/config.yml` was rewritten mid-run: `tbd_version: 0.4.0` -> `0.4.1-dev.6.1e644d1` plus a matching `tbd_upgrades` entry appended (timestamps 19:22:54Z and 19:28:45Z, i.e. during the test window).
- `0.4.1-dev.6.1e644d1` is the version baked into the local `dist/bin.mjs` built by the pre-push build step, so some test path invoked the local build's `setup` (or its config-write path) against the real repository config rather than a fixture.
- Both scrub layers (scripts/scrub-git-env.mjs wrapper and tests/scrub-git-env.ts) were active; this leak bypasses them, so it is presumably not GIT_DIR-based. Related prior work: tbd-a1lc.

Repro attempt: run `git push` (or `pnpm test` directly) in a checkout with a clean tree and diff `.tbd/config.yml` afterwards.
