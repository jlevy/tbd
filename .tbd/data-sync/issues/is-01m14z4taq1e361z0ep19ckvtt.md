---
type: is
id: is-01m14z4taq1e361z0ep19ckvtt
title: SKILL.md does not say beads live on the tbd-sync branch, and its one branch note implies otherwise
kind: bug
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-28-sync-convergence-and-stability.md
labels: []
dependencies: []
parent_id: is-01m14yzbwwg92e5k7z7d4kyn00
created_at: 2026-08-28T19:56:58.582Z
updated_at: 2026-09-14T04:16:50.130Z
closed_at: 2026-09-14T04:16:50.129Z
close_reason: "Already fixed on main: skill-baseline.md:154 states 'Where beads live: on the dedicated tbd-sync branch, not your working branch', and :160/:165 add the raw-git warning and the troubleshooting guideline pointer. Matches the stability sprint plan's disposition for issue #238 (close, already fixed). Verified on 52d5c2f7."
resolution: null
duplicate_of: null
---
GH #238. SKILL.md never states that beads live on the tbd-sync branch, and its single branch-related sentence points the other way: 'Never gitignore .tbd/workspaces/; the outbox must be committed to your working branch.' Read by an agent that does not already know the storage model, that reads as 'bead state goes on your branch'.

The README is clear about it, but agents load SKILL.md, not README.md, and tbd-sync appears in agent-facing docs only inside 'tbd guidelines tbd-sync-troubleshooting', and only as failure symptoms which require already knowing the model in order to parse.

Consequence in #238: after creating 8 beads and closing 7, git status showed nothing under .tbd/ and no bead updates in the branch's commits, so the work looked lost. It had not been - tbd sync had pushed it to tbd-sync as designed - but confirming that meant reading .tbd/.gitignore, then the troubleshooting guideline, then the README. An agent that did not dig would have reported the state wrongly to its user. It also changes what an agent should claim about 'everything is on this PR', since a reviewer does not see bead state in the diff.

Fix: extend the existing note in packages/tbd/docs/shortcuts/system/skill-baseline.md (the generator for .claude/skills/tbd/SKILL.md and .agents/skills/tbd/SKILL.md) to state the storage model before the workspaces exception. Suggested wording is in the issue.
