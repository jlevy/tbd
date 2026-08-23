---
type: is
id: is-01m0pj1ksy7tdf5skcgb90ed0s
title: Committed agent surfaces are stale relative to bundled docs
kind: bug
status: open
priority: 2
version: 1
labels: []
dependencies: []
created_at: 2026-08-23T05:38:40.062Z
updated_at: 2026-08-23T05:38:40.062Z
---
Running 'tbd setup --auto' on a clean checkout rewrites .claude/skills/tbd/SKILL.md, .agents/skills/tbd/SKILL.md, .claude/scripts/ensure-gh-cli.sh, and .codex/ensure-gh-cli.sh with content that is already in packages/tbd/docs/ but was never regenerated into the committed surfaces. The drift is in the skill baseline (bead location on the tbd-sync branch, proxied-session gh guidance) and the gh-cli helper, not in the guideline directory block. Found while confirming that a GUIDELINE_GROUPS change produced no directory drift; reverted there to keep that PR's diff honest. Regenerate and commit these separately, and consider a CI check that fails when a clean 'tbd setup --auto' produces a diff.
