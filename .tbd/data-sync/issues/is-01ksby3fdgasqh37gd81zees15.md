---
type: is
id: is-01ksby3fdgasqh37gd81zees15
title: Adopt .agents/skills as primary Agent Skills install path
kind: task
status: open
priority: 1
version: 10
spec_path: docs/project/specs/active/plan-2026-05-24-multi-agent-skills-hooks-setup.md
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
  - type: blocks
    target: is-01ksgr45bkhqwwfhpna2xytqdz
parent_id: is-01ksc0qwt0v3pg3hgn35sh0s1e
created_at: 2026-05-24T02:47:52.495Z
updated_at: 2026-05-25T23:39:40.498Z
---
setup.ts. Extract SKILL.md write in SetupClaudeHandler.installClaudeSetup() (lines 791-804) into reusable writeSkillFile(targetPath, payload). Payload = loadSkillContent() + getShortcutDirectory() (line 64) + insertAfterFrontmatter DO-NOT-EDIT marker. Write .agents/skills/tbd/SKILL.md unconditionally for every initialized repo (resolved default); mirror identical payload to .claude/skills/tbd/SKILL.md when Claude detected/present. Copy, never symlink.

## Notes

Attached to epic tbd-g9x7. Keep this bead focused on the portable Agent Skills path and setup/status/doctor surface; sibling beads cover Codex startup hooks, repository self-setup, guidelines, gitignore policy, and validation.
