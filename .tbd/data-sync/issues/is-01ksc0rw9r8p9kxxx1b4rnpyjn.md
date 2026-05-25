---
type: is
id: is-01ksc0rw9r8p9kxxx1b4rnpyjn
title: Refactor agent integration path model
kind: task
status: open
priority: 1
version: 8
spec_path: docs/project/specs/active/plan-2026-05-24-multi-agent-skills-hooks-setup.md
labels:
  - agent-skills
  - setup
dependencies:
  - type: blocks
    target: is-01ksby3fdgasqh37gd81zees15
  - type: blocks
    target: is-01ksc0s4vq2w1yyp10fybqpq8t
  - type: blocks
    target: is-01ksc0t1njfwsxfv86vvgdb4y2
  - type: blocks
    target: is-01ksdq6jr5nrtjtc194fz17kry
parent_id: is-01ksc0qwt0v3pg3hgn35sh0s1e
created_at: 2026-05-24T03:34:30.967Z
updated_at: 2026-05-25T23:39:36.153Z
---
packages/tbd/src/lib/integration-paths.ts. Add constants: AGENTS_SKILL_REL=.agents/skills/tbd/SKILL.md, SKILLS_DIST_REL=skills/tbd/SKILL.md, CODEX_DIR_REL=.codex, CODEX_HOOKS_REL=.codex/hooks.json, CODEX_CONFIG_REL=.codex/config.toml, AGENT_SCRIPTS_DIR_REL=scripts/agent (shared session/closing/gh script rels), and AGENT_INTEGRATION_FORMAT=2. Add resolver fns getAgentSkillPaths(), getCodexPaths(), getSharedScriptPaths() mirroring getClaudePaths() (line 93). Add display constants. Keep existing CLAUDE_* constants for back-compat. Foundation for all other beads.
