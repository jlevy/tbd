---
type: is
id: is-01kytfa7bhsf6yz00chqmmkmry
title: "publishing.md: tag content-cutoff note (release vs publish timestamp)"
kind: task
status: closed
priority: 2
version: 4
labels: []
dependencies:
  - type: blocks
    target: is-01kytfaffw8q13xkf5vgkc8qrj
parent_id: is-01kytf97zs21wgfaggn8kdmqbx
created_at: 2026-07-30T21:36:30.577Z
updated_at: 2026-07-30T21:50:16.064Z
closed_at: 2026-07-30T21:50:16.064Z
close_reason: "Implemented in PR #201 (commit 827ffc86): decision rule + egress test + defused signals + prefix form in setup-github-cli.md; prefix-form messaging in ensure-gh-cli.sh bundle and regenerated copies; prime pointer in skill-baseline/tbd-prime/scoped skill; upgrade-refresh test pinned; publishing.md content-cutoff note. 1394 tests pass."
---
GH #195 RC1: v0.4.1 tag points at release-PR merge 889f3c6b (Jul 17 22:00 UTC); PR #194 merged Jul 18 06:10; tag pushed ~22:00 Jul 18 - npm publish time postdates content it does not contain. Build/docs bundling verified correct. Add a Step 6 note: the release ships the tagged commit's tree; before tagging check git log MERGE_SHA..origin/main and deliberately decide (ship next release vs re-cut); publish timestamp is not a content cutoff.
