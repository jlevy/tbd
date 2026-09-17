---
type: is
id: is-01m2qxmd5z1ywx25gq7ccaazbq
title: Remove the stale nested packages/tbd/.claude agent surfaces
kind: chore
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels: []
dependencies: []
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
created_at: 2026-09-17T14:51:48.286Z
updated_at: 2026-09-17T14:51:49.380Z
closed_at: 2026-09-17T14:51:49.379Z
close_reason: Removed from the index and working tree in the commit after dea8b449; settings.local.json left untouched
resolution: null
duplicate_of: null
---
User decision 2026-09-17: remove the tracked leftover packages/tbd/.claude/ (skills/tbd/SKILL.md, hooks/tbd-closing-reminder.sh, settings.json) from when the package was its own project root. Nothing in the build or npm package reads it, but Claude Code loaded its stale skill for work under packages/tbd/ in place of the root skill. The root .claude/ covers the repository. The user's untracked settings.local.json is left in place. Also noted as a residue in plan-2026-09-07 (5d, #238).
