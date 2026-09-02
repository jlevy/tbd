---
type: is
id: is-01m14z4taq1e361z0ep19ckvtt
title: SKILL.md does not say beads live on the tbd-sync branch, and its one branch note implies otherwise
kind: bug
status: open
priority: 2
version: 1
spec_path: docs/project/specs/active/plan-2026-08-28-sync-convergence-and-stability.md
labels: []
dependencies: []
parent_id: is-01m14yzbwwg92e5k7z7d4kyn00
created_at: 2026-08-28T19:56:58.582Z
updated_at: 2026-08-28T19:56:58.582Z
---
GH #238. SKILL.md never states that beads live on the tbd-sync branch, and its single branch-related sentence points the other way: 'Never gitignore .tbd/workspaces/; the outbox must be committed to your working branch.' Read by an agent that does not already know the storage model, that reads as 'bead state goes on your branch'.

The README is clear about it, but agents load SKILL.md, not README.md, and tbd-sync appears in agent-facing docs only inside 'tbd guidelines tbd-sync-troubleshooting', and only as failure symptoms which require already knowing the model in order to parse.

Consequence in #238: after creating 8 beads and closing 7, git status showed nothing under .tbd/ and no bead updates in the branch's commits, so the work looked lost. It had not been - tbd sync had pushed it to tbd-sync as designed - but confirming that meant reading .tbd/.gitignore, then the troubleshooting guideline, then the README. An agent that did not dig would have reported the state wrongly to its user. It also changes what an agent should claim about 'everything is on this PR', since a reviewer does not see bead state in the diff.

Fix: extend the existing note in packages/tbd/docs/shortcuts/system/skill-baseline.md (the generator for .claude/skills/tbd/SKILL.md and .agents/skills/tbd/SKILL.md) to state the storage model before the workspaces exception. Suggested wording is in the issue.
