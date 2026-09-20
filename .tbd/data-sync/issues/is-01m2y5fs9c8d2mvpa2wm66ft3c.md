---
type: is
id: is-01m2y5fs9c8d2mvpa2wm66ft3c
title: "PR #310 D3: Include extra polls in cache cost comparison"
kind: bug
status: in_progress
priority: 2
version: 2
delegate: codex@spud10
labels: []
dependencies: []
parent_id: is-01m2y4ygvt317renehn2caprwa
hold: null
hold_until: null
created_at: 2026-09-20T01:04:32.043Z
updated_at: 2026-09-20T01:18:43.774Z
started_at: 2026-09-20T01:18:43.774Z
---
Review D. Four-minute polls not always cheapest. For 30k Opus prefix minute0..60: 5m TTL 16 polls costs .4125 vs 1h TTL 7 polls .390 excluding output. State cost/latency tradeoff.
