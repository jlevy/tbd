---
type: is
id: is-01m2tn5j3p0mpk42padvbvdewx
title: Drift test for the installed .claude/skills and .agents/skills copies
kind: feature
status: open
priority: 2
version: 1
labels: []
dependencies: []
created_at: 2026-09-18T16:21:36.502Z
updated_at: 2026-09-18T16:21:36.502Z
---
From review G's G4 (https://github.com/jlevy/tbd/pull/309). The committed .claude/skills/tbd/SKILL.md and .agents/skills/tbd/SKILL.md have no byte-for-byte drift test; only a two-string prose spot-check, which G proved stays green with an injected drift line. A byte comparison is not trivial because the installed copies embed the project's shortcut directory, composed from the gitignored .tbd/docs cache (see the G5 bead), so a test must warm the cache or regenerate through the CLI in a temp clone. Tier agents and skills/tbd/SKILL.md are covered.
