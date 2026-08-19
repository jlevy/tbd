---
type: is
id: is-01kytf9vebf9tynnp3598jg57j
title: "Prime output: one-line egress pointer (skill-baseline.md + tbd-prime.md)"
kind: task
status: closed
priority: 1
version: 4
labels: []
dependencies:
  - type: blocks
    target: is-01kytfaffw8q13xkf5vgkc8qrj
parent_id: is-01kytf97zs21wgfaggn8kdmqbx
created_at: 2026-07-30T21:36:18.379Z
updated_at: 2026-07-30T21:50:16.055Z
closed_at: 2026-07-30T21:50:16.055Z
close_reason: "Implemented in PR #201 (commit 827ffc86): decision rule + egress test + defused signals + prefix form in setup-github-cli.md; prefix-form messaging in ensure-gh-cli.sh bundle and regenerated copies; prime pointer in skill-baseline/tbd-prime/scoped skill; upgrade-refresh test pinned; publishing.md content-cutoff note. 1394 tests pass."
---
tbd prime serves SKILL.md composed from skill-baseline.md, NOT tbd-prime.md - the issue's reference patch alone would miss AC3. Add one line near the Session Closing Protocol in skill-baseline.md (egress available => gh works via scoped NO_PROXY => tbd shortcut setup-github-cli, Proxied Remote Sessions) and mirror in tbd-prime.md Core Rules. Regenerate committed SKILL.md surfaces: pnpm build (skills/tbd/SKILL.md) + local setup --auto (.claude/.agents skills, AGENTS.md). GH #195 RC5b.
