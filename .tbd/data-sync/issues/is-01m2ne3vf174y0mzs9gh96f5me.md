---
type: is
id: is-01m2ne3vf174y0mzs9gh96f5me
title: Self-upgrade repository setup to tbd v0.9.0
kind: task
status: closed
priority: 1
version: 5
delegate: claude-code@spud10.local
labels: []
dependencies: []
hold: null
hold_until: null
created_at: 2026-09-16T15:42:08.221Z
updated_at: 2026-09-16T16:53:22.875Z
started_at: 2026-09-16T15:42:18.111Z
closed_at: 2026-09-16T16:53:22.874Z
close_reason: "Installed and dogfooded get-tbd@0.9.0, merged PR #300, and verified the exact merge commit with a fully green cross-platform main CI run."
resolution: null
duplicate_of: null
---
Dogfood the freshly published get-tbd@0.9.0 in this repository: verify npm provenance and release identity, install the exact public tarball under the documented supply-chain exception, run setup idempotently, review generated changes, run quality and package/install smoke checks, then commit, open and merge a green PR, sync tracking state, and leave the worktree clean.

## Notes

Self-upgrade validation on 2026-09-16:

* Verified npm publisher GitHub Actions, maintainer ojoshe, publication timestamp 2026-09-16T10:03:40.305Z, shasum d94a847935c05072944d4048d587c1a17f1db5c9, integrity sha512-XB+oxBqR6oT6CqdmWqAxfRMPI9RZ5ofAEdU91+I+tC/lmwhwH7XqRk7y4m/KLB9WqtYKK9dTvr5jQR7jg57zBA==, and SLSA provenance.
* Signed provenance resolves refs/tags/v0.9.0 in https://github.com/jlevy/tbd to git commit f005c19d2129b2e86f6d4cb43d2776b8c03f2f7b and release workflow run 35082264977.
* User explicitly requested dogfooding the fresh release, approving the documented release-age exception. Installed the exact registry tarball URL globally with lifecycle scripts disabled; did not relax global age policy.
* Removed a shadowing FNM-global get-tbd@0.8.1 through npm. The active command is now /Users/levy/.local/bin/tbd and reports 0.9.0; npm global inventory also reports get-tbd@0.9.0.
* npm cannot audit global installations, so reproduced the exact tarball install in an isolated temporary project. `npm audit --omit=dev` found 0 vulnerabilities; `npm audit signatures` verified all 67 registry signatures and 3 attestations.
* `tbd setup --auto` updated only .tbd/config.yml: current/fallback 0.8.1 -> 0.9.0 plus one upgrade-history entry. A second setup pass left the patch byte-identical (SHA-256 02feb6b437f1af7d8632708de5fa224b7b46afd192a24bf570f15c471c569274).
* `tbd status --json` reports initialized 0.9.0, healthy shared worktree, zero doc drift, and all four integration surfaces installed. `tbd doctor --json` reports healthy=true with every health and integration check OK.
* Format, Markdown format, typecheck, ESLint/config contract, action pins, and production build passed.
* Default parallel full-suite attempts hit different load-sensitive subprocess timeouts/failure-injection interference. Every reported test passed in isolation. The definitive run used Vitest 4's documented `--maxWorkers=1 --no-file-parallelism` controls: 176/176 files passed, 2,655 passed, 1 intentional skip.
* The default full suite also passed in the pre-push hook: 176/176 files passed, 2,655 passed, 1 intentional skip.
* `pnpm audit --prod` reports no known vulnerabilities. `pnpm check:package-age` passed 31 pins with 0 violations.
* Committed the one-file setup change as 24922b89 and opened PR #300. Its first Windows job had one unchanged setup-flow test exceed its 60-second timeout under full-suite load; that exact test passed locally in 4.33 seconds. The Windows rerun passed in 8m32s, leaving the entire PR matrix green.
* PR #300 merged to main as a8167a2edade16bea3b282c349e310f0faa60c10. The exact-SHA post-merge CI run 35123755542 completed successfully: Coverage & Lint, Benchmark, Ubuntu Node 22.12.0, Ubuntu Node 24, macOS Node 24, and Windows Node 24 all passed.
* The local checkout was fast-forwarded to the merge SHA, the deleted review-branch ref was pruned, and the current branch now tracks origin/main at +0/-0. The user's unrelated pre-existing stash was preserved.
