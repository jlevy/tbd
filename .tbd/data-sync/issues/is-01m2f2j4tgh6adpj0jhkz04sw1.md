---
type: is
id: is-01m2f2j4tgh6adpj0jhkz04sw1
title: "Publish and verify the tbd skill on skills.sh: 23 checklist items in an active spec with no beads"
kind: task
status: open
priority: 3
version: 1
spec_path: docs/project/specs/active/plan-2026-02-08-tbd-on-skills-sh.md
labels: []
dependencies: []
created_at: 2026-09-14T04:24:47.183Z
updated_at: 2026-09-14T04:24:47.183Z
---
`docs/project/specs/active/plan-2026-02-08-tbd-on-skills-sh.md` sits in `active/` with 23 unchecked items and zero beads, so none of its remaining work is visible to `tbd ready` or to any spec-based selector. Found by the 2026-09-14 reconciliation pass; filed so the residue is tracked rather than silently refiled as a draft.

Its status line reads 'Mostly landed — the distribution copy now exists', which matches the repository: `skills/tbd/SKILL.md` is committed. What is left is the publish-and-verify half, and it is mostly external:

- create/confirm the skills directory layout expected by skills.sh
- validate SKILL.md against the Agent Skills spec
- test local installation, then installation from the GitHub URL
- push to main and confirm the listing appears on the skills.sh leaderboard

Two of those are one-time external actions on someone else's service, so this may be a decision rather than an implementation task: either run the publish steps and close the spec, or record that publishing to skills.sh was dropped and move the spec to `paused/`. Do not leave it in `active/` with no beads.
