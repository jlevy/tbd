---
type: is
id: is-01kytfa5t4bbtyfnhzd89edexb
title: "Test: setup --auto refreshes a stale ensure-gh-cli.sh (upgrade path)"
kind: task
status: closed
priority: 1
version: 4
labels: []
dependencies:
  - type: blocks
    target: is-01kytfaffw8q13xkf5vgkc8qrj
parent_id: is-01kytf97zs21wgfaggn8kdmqbx
created_at: 2026-07-30T21:36:28.996Z
updated_at: 2026-07-30T21:50:16.060Z
closed_at: 2026-07-30T21:50:16.060Z
close_reason: "Implemented in PR #201 (commit 827ffc86): decision rule + egress test + defused signals + prefix form in setup-github-cli.md; prefix-form messaging in ensure-gh-cli.sh bundle and regenerated copies; prime pointer in skill-baseline/tbd-prime/scoped skill; upgrade-refresh test pinned; publishing.md content-cutoff note. 1394 tests pass."
---
GH #195 RC2 investigation: v0.4.1 setup.ts ALREADY rewrites .claude/scripts/ensure-gh-cli.sh unconditionally (and Codex surface stale-detects); downstream saw 'stale left in place' because 0.4.1's own bundle was pre-#194. The managed refresh exists but nothing pins it. Add setup-flows test: initial setup, overwrite .claude and .codex script copies with stale content, re-run setup --auto, assert both match the bundled script. Decision: no tbd doctor staleness check - redundant beside the unconditional rewrite.
