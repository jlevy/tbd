---
type: is
id: is-01ktybykhe3b5ampe085nc87ha
title: Generated agent surfaces omit configured custom shortcut lookup paths
kind: bug
status: open
priority: 1
version: 1
spec_path: docs/project/specs/active/plan-2026-05-24-multi-agent-skills-hooks-setup.md
labels:
  - docs
  - agent-skills
  - setup
dependencies: []
parent_id: is-01ksc0qwt0v3pg3hgn35sh0s1e
created_at: 2026-06-12T16:51:54.541Z
updated_at: 2026-06-12T16:51:54.541Z
---
PR #153 review repro: after tbd setup --auto, a copied/forked shortcut placed in .tbd/docs/shortcuts/custom and added to docs_cache.lookup_path appears in tbd shortcut --list, but is omitted from tbd skill, tbd prime, and regenerated .agents/skills/tbd/SKILL.md, .claude/skills/tbd/SKILL.md, and AGENTS.md. Root cause: shortcut.ts reads config.docs_cache.lookup_path, while setup.ts/skill.ts/prime.ts build generated directories from DEFAULT_SHORTCUT_PATHS and DEFAULT_GUIDELINES_PATHS only. Add a shared effective doc-path resolver and regression coverage for custom/copied/forked docs in all generated agent surfaces.
