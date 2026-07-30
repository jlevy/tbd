---
type: is
id: is-01kytf9swzw9k8r4v8qrdpqvgw
title: "ensure-gh-cli.sh: per-command prefix guidance in proxy-intercept message"
kind: task
status: closed
priority: 1
version: 4
labels: []
dependencies:
  - type: blocks
    target: is-01kytfaffw8q13xkf5vgkc8qrj
parent_id: is-01kytf97zs21wgfaggn8kdmqbx
created_at: 2026-07-30T21:36:16.799Z
updated_at: 2026-07-30T21:50:16.050Z
closed_at: 2026-07-30T21:50:16.050Z
close_reason: "Implemented in PR #201 (commit 827ffc86): decision rule + egress test + defused signals + prefix form in setup-github-cli.md; prefix-form messaging in ensure-gh-cli.sh bundle and regenerated copies; prime pointer in skill-baseline/tbd-prime/scoped skill; upgrade-refresh test pinned; publishing.md content-cutoff note. 1394 tests pass."
---
Add 3 echo lines after the export recipe in the GH_TOKEN-valid-but-proxied branch: agent harnesses reset shell state between tool calls; show the per-command NO_PROXY/no_proxy prefix form (host list repeated in both vars since a prefix cannot reference itself). Edit bundle at packages/tbd/docs/install/ensure-gh-cli.sh, then regenerate .claude/scripts/ and .codex/ copies via local build setup --auto. GH #195 RC5a.
