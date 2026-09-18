---
type: is
id: is-01m2sfsbvspcwgm9jsd6z5bm05
title: "PR #309 D2: regenerate stale .claude/.agents skill copies instead of hand-editing"
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
created_at: 2026-09-18T05:28:19.577Z
updated_at: 2026-09-18T05:28:29.476Z
started_at: 2026-09-18T05:28:29.476Z
---
Medium. .claude/skills/tbd/SKILL.md:203 and .agents/skills/tbd/SKILL.md:203 still have pre-B4 'The current conversation overrides both for that task'.
34db3783 hand-edited generated surfaces. tbd doctor reports both stale.
Review: https://github.com/jlevy/tbd/pull/309#pullrequestreview-5244525171
Fix: tbd setup --auto --surfaces=claude,portable; restore .tbd/config.yml; commit regenerated files. Consider drift test.
