---
type: is
id: is-01kzn4vzfg9rf1y46y5vkn5mey
title: "Review finding: delimit configured watch remote from Git options"
kind: bug
status: closed
priority: 1
version: 3
labels: []
dependencies: []
parent_id: is-01kzn47zwk7319adecbtgm3n3p
created_at: 2026-08-10T06:13:27.663Z
updated_at: 2026-08-15T05:33:40.460Z
closed_at: 2026-08-15T05:33:40.460Z
close_reason: "Shipped in merged PR #205; the final senior review confirmed these findings were addressed."
---
PR #205 final branch audit found that watch passes the configured remote directly after Git options. GitRemoteName permits leading hyphens, so a repository config value can be parsed as a Git option (notably fetch --all) instead of the remote. Add the standard -- delimiter to new watch ls-remote/fetch calls and pin the exact Git argument contract.
