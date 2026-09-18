---
type: is
id: is-01m2sfsc62t5nt4ww7qwq7th6y
title: "PR #309 D3: exclude .claude/agents from format:md and regenerate byte-exact"
kind: bug
status: in_progress
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
delegate: unknown@cursor
labels: []
dependencies: []
parent_id: is-01m2sfrx39adcthk03qmd41j53
hold: null
hold_until: null
created_at: 2026-09-18T05:28:19.906Z
updated_at: 2026-09-18T05:28:29.478Z
started_at: 2026-09-18T05:28:29.478Z
---
Medium. lefthook.yml format-md excludes; package.json format:md scripts; .claude/agents/tbd-*.md reflowed by flowmark.
Review: https://github.com/jlevy/tbd/pull/309#pullrequestreview-5244525171
Fix: add .claude/agents/** to both format:md exclude lists, regenerate with tbd setup --auto --surfaces=claude-agents, commit byte-exact output.
Note: #310 already has this exclude; still needed on #309 so doctor is not noisy at this layer.
