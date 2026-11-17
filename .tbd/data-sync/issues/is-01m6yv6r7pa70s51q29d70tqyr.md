---
type: is
id: is-01m6yv6r7pa70s51q29d70tqyr
title: "PR #332 A2: generated Codex SessionStart/PreCompact/gh-cli commands are cwd-relative"
kind: bug
status: closed
priority: 2
version: 2
labels: []
dependencies: []
parent_id: is-01m6yv6qega7ts908s41sm9pqm
created_at: 2026-11-09T00:26:52.022Z
updated_at: 2026-11-09T00:41:15.017Z
closed_at: 2026-11-09T00:41:15.017Z
close_reason: "Fixed in 842ef29e on PR #332; disposition reply posted"
resolution: null
duplicate_of: null
---
Medium. setup.ts generated bash .codex/tbd-session.sh etc., which exit 127 from a subdirectory. Review: https://github.com/jlevy/tbd/pull/332#pullrequestreview-5820355604
