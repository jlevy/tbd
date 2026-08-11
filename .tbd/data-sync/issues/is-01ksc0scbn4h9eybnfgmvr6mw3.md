---
type: is
id: is-01ksc0scbn4h9eybnfgmvr6mw3
title: Add Codex startup and gh CLI setup parity
kind: task
status: open
priority: 1
version: 17
spec_path: docs/project/specs/active/plan-2026-05-24-multi-agent-skills-hooks-setup.md
labels:
  - codex
  - hooks
  - setup
dependencies:
  - type: blocks
    target: is-01ksc0skpmwe30svw66fjsztwg
  - type: blocks
    target: is-01ksc0sv2xc7j6wnb9xzsep7fg
  - type: blocks
    target: is-01ksc0ta2n1q3nkr2791574t56
  - type: blocks
    target: is-01ksgr45bkhqwwfhpna2xytqdz
parent_id: is-01ksc0qwt0v3pg3hgn35sh0s1e
created_at: 2026-05-24T03:34:47.412Z
updated_at: 2026-08-11T07:07:53.983Z
extensions:
  linear:
    id: 3cf6fe4a-7e19-4b26-acbf-a83a96bf68ca
    key: TBD-27
    url: https://linear.app/finterm-ai/issue/TBD-27/add-codex-startup-and-gh-cli-setup-parity
    linked_at: 2026-08-10T19:36:47.061Z
    comments:
      - id: f8281b75-64d9-4b13-b3c7-2b6b0c4ce458
        at: 2026-08-11T07:07:28.273Z
        author: josh
        body: |-
          **tbd sync conflict**

          Field `description` on `tbd-orup` diverged and one value was discarded.

          - Kept: `"sha256v2:26bbfd70526284f0d2da0d1d1ecf8ac6acb4707cbe9098fbf838a3b9a7e2b14b"`
          - Discarded: `"sha256v2:9a5aba6bb3de08747a87d3eb475d51a4817237603b2640048dfd0af0fd717610"`

          The discarded value is archived at `.tbd/data-sync/attic/conflicts/is-01ksc0scbn4h9eybnfgmvr6mw3`.
          Resolve this comment once the divergence has been reconciled.
---
setup.ts. Add Codex hook install writing .codex/hooks.json (or inline [hooks] in .codex/config.toml): SessionStart->tbd prime, PreCompact->tbd prime --brief, PostToolUse(git push)->closing reminder, SessionStart->ensure gh. Codex uses the SAME event schema as Claude (verified May 2026; command handlers only) so the mapping is ~1:1. Relocate shared scripts from .claude/scripts/ to scripts/agent/ (TBD_SESSION_SCRIPT line 126, TBD_CLOSE_PROTOCOL_SCRIPT line 250, [ensure-gh-cli.sh](<http://ensure-gh-cli.sh>)); update CLAUDE_SESSION_HOOKS (line 210) and CLAUDE_PROJECT_HOOKS (line 231) commands to reference shared paths (or wrapper) so existing Claude hooks keep working. Codex hooks must not reference .claude/.

## Notes

Downstream pprose audit called out cross-tree coupling as a risk: Codex hooks should not call .claude/scripts/tbd-session.sh. Verify current tbd behavior against official Codex hooks docs before implementation.
