---
type: is
id: is-01m0ph9vnqnq5cww3fv22knsyp
title: Register the new docs and regenerate the skill files
kind: task
status: open
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-23-rust-quality-floor-and-guideline-mapping.md
labels: []
dependencies:
  - type: blocks
    target: is-01m0phadvepybz953kjh2r6skr
  - type: blocks
    target: is-01m0phafp707w8m9vwq9691f0z
parent_id: is-01m0ph6ehhhryj0z52a1c3b3rv
created_at: 2026-08-23T05:25:41.687Z
updated_at: 2026-08-23T05:26:02.183Z
---
Add every new guideline and shortcut to docs_cache.files in .tbd/config.yml as internal: docrefs, or tbd docs sync will not serve them. Then regenerate .claude/skills/tbd/SKILL.md, .agents/skills/tbd/SKILL.md, skills/tbd/SKILL.md, and AGENTS.md, which embed the generated directory between BEGIN SHORTCUT DIRECTORY markers. tbd-o732 recorded a guideline added without this step being invisible to agents.
