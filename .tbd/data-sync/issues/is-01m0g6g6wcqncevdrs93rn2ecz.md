---
type: is
id: is-01m0g6g6wcqncevdrs93rn2ecz
title: "PR #248 review R5: 'pure with respect to platform' doc comment overclaims for relative inputs"
kind: task
status: closed
priority: 3
version: 2
labels: []
dependencies: []
parent_id: is-01m0g6fe52d2fr6vftwvzssgqj
created_at: 2026-08-20T18:21:28.844Z
updated_at: 2026-08-20T20:29:46.398Z
closed_at: 2026-08-20T20:29:46.398Z
close_reason: "Fixed on PR #248 head a0e3dbf by a parallel session, and independently verified here: 20 unit tests pass (incl. npmPrefixCommand for win32 and the quoted-PATH cases), the doctor golden passes both on a healthy host and under npm_config_prefix=/tmp/off-path-prefix, both SKILL.md files list agent-session-bootstrap, and .tbd/config.yml carries no dev-build version churn. Live doctor is silent when healthy and warns with the full suggestion when off PATH."
resolution: null
duplicate_of: null
---
packages/tbd/src/lib/npm-global-bin.ts:26-31 — posix.resolve and win32.resolve both fall back to process.cwd(), so a relative PATH entry still resolves against the host cwd. Harmless in practice (npm prefixes and PATH entries are absolute) but the comment's 'keeps them pure and testable from any host' overstates it.

Fix: name the absolute-input precondition in the comment.
