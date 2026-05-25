---
type: is
id: is-01ksc0s4vq2w1yyp10fybqpq8t
title: Add skills/tbd distribution source
kind: task
status: open
priority: 1
version: 5
spec_path: docs/project/specs/active/plan-2026-05-24-multi-agent-skills-hooks-setup.md
labels:
  - agent-skills
  - setup
dependencies: []
parent_id: is-01ksc0qwt0v3pg3hgn35sh0s1e
created_at: 2026-05-24T03:34:39.734Z
updated_at: 2026-05-25T23:39:36.730Z
---
Generate committed repo-root skills/tbd/SKILL.md from the same payload (extend scripts/copy-docs.mjs lines 95-104). Resolved default: commit it AND add a drift test in tests/integration-files.test.ts that regenerates and compares. Enables npx skills add / skills.sh discovery.
