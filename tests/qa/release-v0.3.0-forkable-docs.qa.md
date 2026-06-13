---
title: QA Playbook
description: Manual release-readiness and upgrade validation for get-tbd v0.3.0 (forkable docs, f04 → f05 on-disk format migration)
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# QA Playbook: Release v0.3.0 Forkable Docs

Manual QA playbook for cutting `get-tbd` v0.3.0 — the release that ships the
forkable-docs workflow and the `f04` → `f05` on-disk format stamp (spec:
`docs/project/specs/done/plan-2026-06-11-forkable-docs.md`).

**Purpose**: Prove that (a) the new client stamps real `f04` repos to `f05` idempotently
and older clients fail closed against `f05`, (b) the fork lifecycle
(fork/edit/update/unfork) behaves on a real repo with real upgrades — not just fixtures,
(c) running tbd inside git hooks is safe (the `GIT_DIR` isolation), and (d) the
published `v0.3.0` works in day-to-day use after the global install is swapped.

**Estimated Time**: ~60–90 minutes (10 min prep, 35–50 min scenarios, 20 min release +
post-publish + global swap).

> This is a manual test: too costly / not pass-fail-crisp to fully cover in unit or
> tryscript tests. The automated suites cover the fork kernel, the f05 stamp, the docs
> surface goldens, and GIT_DIR isolation in fixtures; this playbook covers real user
> repos, a real upgrade sequence across releases, and the published release surface
> installed globally.

* * *

## Current Status (last update 2026-06-13)

| Phase | Status | Notes |
| --- | --- | --- |
| Phase 0: Pre-flight — sync, version, decide bump | ⏳ Pending | Version `v0.3.0` proposed (0.x semver: format change ⇒ minor bump). CHANGELOG Unreleased entry written on PR #169. |
| Phase 1: In-repo sanity (build, test, publint) | ✅ Passed | At PR #169 head: 1,313 unit tests + 881 tryscript blocks green; CI green on ubuntu/macos/windows + coverage/lint + benchmark. |
| Phase 2: Real-repo f04 → f05 upgrade scenarios | ⏳ Pending |  |
| Phase 3: Fork lifecycle on a real repo | ⏳ Pending |  |
| Phase 4: Hook-safety (GIT_DIR) on a real repo | ⏳ Pending |  |
| Phase 5: Cut release v0.3.0 | ⏳ Pending | Per docs/publishing.md. |
| Phase 6: Post-publish verification + global swap | ⏳ Pending |  |

**Status Legend**: ✅ Passed | ❌ Failed | ⏳ Pending | ⏸️ Blocked

* * *

## Phase 0: Pre-flight

1. `git fetch && git status` — main is current, working tree clean.
2. `tbd sync` — beads clean; spec epic `tbd-67ek` and all children closed.
3. Confirm version bump: `v0.3.0` (format `f05` ships; 0.x minor signals it).
4. Review CHANGELOG Unreleased entry against the shipped surface.

## Phase 1: In-repo sanity

1. `pnpm install && pnpm build && pnpm test` — all green.
2. `pnpm -r exec publint` — clean.
3. `node packages/tbd/dist/bin.mjs docs` — overview renders; `tbd docs list` shows
   guidelines/shortcuts/templates/references including `docref-format`, `docmap-format`,
   `tbd-docs`, `tbd-design`.

## Phase 2: Real-repo f04 → f05 upgrade

Run on at least one real repo currently on `f04` (with real issue history), using the
release candidate build.

1. **Stamp**: any issue command (e.g. `tbd list`) co-migrates: `.tbd/config.yml` gains
   `tbd_format: f05`; the one-line notice names the change.
   Re-run — idempotent, no second notice, no diff.
2. **Linked worktrees**: in a sibling worktree of the same repo, run `tbd list` — shared
   layout consistent; per-checkout config stamps once per checkout.
3. **Old client fails closed**: with the previous global version (`0.2.x`), run
   `tbd list` in the migrated repo — clean refusal naming the format and the upgrade
   command; no writes.
4. **Data integrity**: `tbd doctor` green; issue counts identical before/after;
   spot-read a few issues.

## Phase 3: Fork lifecycle on a real repo

1. `tbd docs` (zero forks) — three-posture menu; `tbd setup --auto` shows the same menu.
2. `tbd docs fork python-rules` → file in `docs/tbd/guidelines/`, manifest committed;
   `tbd guidelines python-rules` serves the fork with the stderr provenance note.
3. Edit the fork; `tbd docs status` shows `customized`; `tbd status` shows the Docs
   line.
4. `tbd docs fork --category=general --dry-run` — sensible selection, no writes.
5. Upgrade simulation: after installing a build with changed bundled docs (or
   hand-editing the cache copy), `tbd docs update` refreshes unmodified forks, merges
   clean changes, and lists conflicts without touching them; `--merge` writes markers;
   resolving returns the doc to `customized`.
6. `tbd docs unfork --all` equivalents leave the repo pristine (fork dir and README
   removed when empty); `git status` clean apart from intended files.
7. `tbd docs add ./<some-local-doc>.md --kind=guideline` — canonical docref recorded;
   `tbd docs sync` re-syncs from it.

## Phase 4: Hook-safety (GIT_DIR)

1. In a real repo, add a `post-commit` hook that runs `tbd list > /tmp/tbd-hook-out`.
   Commit something: the hook output is this repo’s issues, stderr shows the one-line
   “ignoring inherited GIT_DIR” notice, and no other repo is touched.
2. From a linked worktree, `git push` with the lefthook pre-push suite (this repo): refs
   and tbd data byte-identical afterwards (the tbd-a1lc regression scenario).

## Phase 5: Cut release

Follow `docs/publishing.md` (tag-triggered pipeline).
Confirm the GitHub release notes match the CHANGELOG entry.

## Phase 6: Post-publish verification + global swap

1. `npm install -g get-tbd@latest` on this machine; `tbd --version` is `0.3.0`.
2. Re-run Phase 2 step 1 and Phase 3 steps 1–3 with the published binary on a fresh
   clone of a real repo.
3. Day-to-day smoke: `tbd prime`, `tbd ready`, create/close an issue, `tbd sync`.

## Findings

(Record findings as beads with `tbd create`, link them here.)

| Finding | Bead | Status |
| --- | --- | --- |
|  |  |  |
