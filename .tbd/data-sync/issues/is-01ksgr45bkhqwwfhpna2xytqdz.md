---
type: is
id: is-01ksgr45bkhqwwfhpna2xytqdz
title: Implement existing-install upgrade, migration and format guard
kind: task
status: closed
priority: 1
version: 6
spec_path: docs/project/specs/active/plan-2026-05-24-multi-agent-skills-hooks-setup.md
labels: []
dependencies:
  - type: blocks
    target: is-01ksc0skpmwe30svw66fjsztwg
  - type: blocks
    target: is-01ksc0ta2n1q3nkr2791574t56
parent_id: is-01ksc0qwt0v3pg3hgn35sh0s1e
created_at: 2026-05-25T23:39:35.667Z
updated_at: 2026-08-15T05:34:12.687Z
closed_at: 2026-08-15T05:34:12.687Z
close_reason: "Shipped in the current setup system: generated agent surfaces, Codex integration, gitignore policy, format migrations, fallback pinning, surface selection, and end-to-end tests are present on main."
extensions:
  linear:
    id: db482f8e-9167-4f53-8a73-863694f262ef
    key: TBD-17
    url: https://linear.app/finterm-ai/issue/TBD-17/implement-existing-install-upgrade-migration-and-format-guard
    linked_at: 2026-08-10T19:37:09.547Z
---
setup.ts. Self-upgrade prior installs idempotently and SAFELY: detect legacy format-1 AGENTS block -> replace managed region with compact format-2; add missing .agents/skills; refresh .claude mirror; install .codex artifacts; dedupe only tbd-owned hooks (by command/path/signature, cf installClaudeSetup dedup line 683); preserve user content. Print itemized summary. FORMAT GUARD: when an artifact integration-format is NEWER than AGENT_INTEGRATION_FORMAT this tbd knows, ERROR and recommend npm install -g get-tbd@latest instead of overwriting (AGENTS block, skill DO-NOT-EDIT header, hook signature). This is Tier-2 self-installing behavior per cli-agent-skill-patterns.md 6.0/6.6. Test that a too-new format string triggers the upgrade-tbd error.
