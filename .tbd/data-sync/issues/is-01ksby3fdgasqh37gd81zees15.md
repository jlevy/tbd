---
type: is
id: is-01ksby3fdgasqh37gd81zees15
title: Adopt .agents/skills as primary Agent Skills install path
kind: task
status: open
priority: 1
version: 6
labels:
  - agent-skills
  - setup
dependencies:
  - type: blocks
    target: is-01ksc0s4vq2w1yyp10fybqpq8t
  - type: blocks
    target: is-01ksc0skpmwe30svw66fjsztwg
  - type: blocks
    target: is-01ksc0sv2xc7j6wnb9xzsep7fg
  - type: blocks
    target: is-01ksc0ta2n1q3nkr2791574t56
parent_id: is-01ksc0qwt0v3pg3hgn35sh0s1e
created_at: 2026-05-24T02:47:52.495Z
updated_at: 2026-05-24T03:36:27.125Z
---
Research confirms tbd's guidelines and setup behavior are behind the current Agent Skills ecosystem. Follow-up work: update cli-agent-skill-patterns.md to recommend .agents/skills as the portable default, keep AGENTS.md as always-on repo orientation, keep .claude/skills as a Claude Code mirror, update tbd setup/status/doctor/tests to write and report .agents/skills/tbd/SKILL.md, add skills/tbd/SKILL.md for skills.sh discovery, and validate with skills-ref / npx skills add. Research: docs/project/research/current/research-agent-skills-standard-paths.md

## Notes

Attached to epic tbd-g9x7. Keep this bead focused on the portable Agent Skills path and setup/status/doctor surface; sibling beads cover Codex startup hooks, repository self-setup, guidelines, gitignore policy, and validation.
