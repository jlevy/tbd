---
type: is
id: is-01ksrpdkemmkkhh4j6egqyrvsq
title: "[task] Cut and publish v0.2.0 (tag-triggered release.yml)"
kind: task
status: in_progress
priority: 0
version: 6
spec_path: tests/qa/release-v0.2.0-upgrade.qa.md
labels:
  - v0.2.0
dependencies:
  - type: blocks
    target: is-01ksrpdqq35gddkbpr21xrdrqd
parent_id: is-01ksrpb7b8cfwrzzd34ya9874q
child_order_hints:
  - is-01kss1csd6spmwvb7g6ay48yy6
  - is-01kss1cz76fp8ps6t85xp0bd2y
  - is-01kss1d6f60tssxej7gc6rgmjh
created_at: 2026-05-29T01:43:43.315Z
updated_at: 2026-05-29T04:55:44.357Z
---
Final cut. Follow docs/publishing.md (after tbd-aaaa relocates the content there).

Steps:
- Branch claude/release-v0.2.0 from main
- Bump packages/tbd/package.json version → 0.2.0
- CHANGELOG '## 0.2.0' from tbd-aaaa
- pnpm build && pnpm release:verify && pnpm test (all must pass)
- Commit 'chore: release get-tbd v0.2.0', push, open PR, wait for CI green, merge
- Tag v0.2.0 from updated main, push tag
- release.yml runs: build, publint, 'pnpm -r publish' to npm with provenance, GH Release
- Verify: 'npm view get-tbd@0.2.0 version', 'gh release view v0.2.0'

Blocks-on: all other v0.2.0 beads in this epic.
