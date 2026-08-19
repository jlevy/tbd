---
type: is
id: is-01ksc0t1njfwsxfv86vvgdb4y2
title: Audit gitignore policy for agent integration files
kind: task
status: closed
priority: 1
version: 8
spec_path: docs/project/specs/active/plan-2026-05-24-multi-agent-skills-hooks-setup.md
labels:
  - gitignore
  - setup
dependencies:
  - type: blocks
    target: is-01ksc0thbsjf1629exkpyd5xn7
parent_id: is-01ksc0qwt0v3pg3hgn35sh0s1e
created_at: 2026-05-24T03:35:09.233Z
updated_at: 2026-08-15T05:34:12.649Z
closed_at: 2026-08-15T05:34:12.649Z
close_reason: "Shipped in the current setup system: generated agent surfaces, Codex integration, gitignore policy, format migrations, fallback pinning, surface selection, and end-to-end tests are present on main."
extensions:
  linear:
    id: d270f03b-6302-474f-936f-5456dc566200
    key: TBD-25
    url: https://linear.app/finterm-ai/issue/TBD-25/audit-gitignore-policy-for-agent-integration-files
    linked_at: 2026-08-10T19:36:52.491Z
---
Ensure .agents/skills/tbd/SKILL.md, .claude/skills/tbd/SKILL.md, AGENTS.md, .codex/* project files, scripts/agent/*, and skills/tbd/SKILL.md are NOT gitignored. Check .claude/.gitignore (currently *.bak) and root .gitignore. Only ignore caches/.tbd/docs/backups.
