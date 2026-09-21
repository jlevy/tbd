---
type: is
id: is-01m30p722tark0d2bpnx35j8sk
title: "PR #310: accidental packages/tbd/node_modules symlink breaks all CI installs"
kind: bug
status: closed
priority: 0
version: 4
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
delegate: unknown@cursor
labels: []
dependencies: []
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
hold: null
hold_until: null
created_at: 2026-09-21T00:35:20.794Z
updated_at: 2026-09-21T02:35:48.025Z
started_at: 2026-09-21T00:35:29.304Z
closed_at: 2026-09-21T02:35:48.025Z
close_reason: "Symlink hole closed in 38519193 (gitignore node_modules without trailing slash). Later F6 golden drift was a separate issue (tbd-d9yu / 4d80424c). PR #310 is 7/7 at 4d80424c."
resolution: null
duplicate_of: null
---
85e2d023 on claude/sharp-tesla-dqt372 (PR #310) committed a symlink
`packages/tbd/node_modules` pointing at the author's machine path
`/Users/levy/wrk/github/tbd/packages/tbd/node_modules`.

`.gitignore` has `node_modules/` (directories only), so git accepted the
symlink. Checkout leaves a dangling link; `pnpm install --frozen-lockfile`
cannot `mkdir packages/tbd/node_modules` and every CI job fails at install
(ubuntu 22/24, macos 24, windows 24, Coverage & Lint, Benchmark).

Not rebase wreckage: #309 head c122b241 is green 7/7; #310 unique Review F
work is real. Fix: untrack the symlink, keep the rest of 85e2d023, ignore
`node_modules` without a trailing slash.

## Notes

Root cause: 85e2d023 added a symlink packages/tbd/node_modules -> /Users/levy/wrk/github/tbd/packages/tbd/node_modules. .gitignore had node_modules/ (dirs only), so git accepted the link. Checkout left a dangling symlink; pnpm install could not mkdir packages/tbd/node_modules. All six failing jobs died at install (not a Windows flake, not rebase wreckage).

#309 head c122b241 stayed green 7/7. #310 unique Review F work was real.

Someone rewrote 85e2d023 -> 493e418f (same unique files, symlink dropped). This session pushed 38519193 on top: ignore node_modules without a trailing slash so a host symlink cannot be committed again.
