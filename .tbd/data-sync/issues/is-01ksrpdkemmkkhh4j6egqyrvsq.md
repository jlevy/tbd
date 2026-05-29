---
type: is
id: is-01ksrpdkemmkkhh4j6egqyrvsq
title: "[task] Cut and publish v0.2.0 (tag-triggered release.yml)"
kind: task
status: closed
priority: 0
version: 8
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
  - is-01kss1z6j5atng0k975bqsfdc7
created_at: 2026-05-29T01:43:43.315Z
updated_at: 2026-05-29T06:18:34.344Z
closed_at: 2026-05-29T06:18:34.338Z
close_reason: "Tagged v0.2.0 on 20303cf (merge commit of PR #138), pushed tag, release.yml run 26621507808 completed successfully. Published: npm view get-tbd@0.2.0 version → 0.2.0; latest dist-tag → 0.2.0; GitHub Release v0.2.0 created at https://github.com/jlevy/tbd/releases/tag/v0.2.0. One advisory annotation: pnpm/action-setup@v4 and softprops/action-gh-release@v2 still on Node 20 (deprecated; forced to Node 24 in June 2026) — tracked as follow-up."
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
