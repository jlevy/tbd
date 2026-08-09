---
type: is
id: is-01kytf9g7w410e6pegkmg7ekne
title: "setup-github-cli.md: decision rule, egress test, defused contradictory signals, prefix form"
kind: task
status: closed
priority: 1
version: 4
labels: []
dependencies:
  - type: blocks
    target: is-01kytfaffw8q13xkf5vgkc8qrj
parent_id: is-01kytf97zs21wgfaggn8kdmqbx
created_at: 2026-07-30T21:36:06.907Z
updated_at: 2026-07-30T21:50:16.032Z
closed_at: 2026-07-30T21:50:16.032Z
close_reason: "Implemented in PR #201 (commit 827ffc86): decision rule + egress test + defused signals + prefix form in setup-github-cli.md; prefix-form messaging in ensure-gh-cli.sh bundle and regenerated copies; prime pointer in skill-baseline/tbd-prime/scoped skill; upgrade-refresh test pinned; publishing.md content-cutoff note. 1394 tests pass."
---
Add 'The decision rule' section (egress decides; one-command egress test via NO_PROXY curl to api.github.com/octocat; open=any response bearing x-github-request-id, closed=timeout/connection failure). Name and defuse the three contradictory signals verbatim (built-in no-gh prompt, proxy 403 docs, proxy 403 body re Claude GitHub App). Retitle channel list to 'The channels'. Add per-command NO_PROXY/no_proxy prefix form with the FULL host list (not the 3-host short list from the issue patch). Add Quick Reference rows for the 403 body and vanishing exports. GH #195 RC3+RC4+RC5a.
