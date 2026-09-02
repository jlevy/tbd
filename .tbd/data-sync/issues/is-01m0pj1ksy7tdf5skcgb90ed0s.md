---
type: is
id: is-01m0pj1ksy7tdf5skcgb90ed0s
title: Committed agent surfaces are stale relative to bundled docs
kind: bug
status: open
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-08-28-sync-convergence-and-stability.md
labels: []
dependencies: []
created_at: 2026-08-23T05:38:40.062Z
updated_at: 2026-08-28T19:56:13.544Z
---
Running 'tbd setup --auto' on a clean checkout rewrites .claude/skills/tbd/SKILL.md, .agents/skills/tbd/SKILL.md, .claude/scripts/ensure-gh-cli.sh, and .codex/ensure-gh-cli.sh with content that is already in packages/tbd/docs/ but was never regenerated into the committed surfaces. The drift is in the skill baseline (bead location on the tbd-sync branch, proxied-session gh guidance) and the gh-cli helper, not in the guideline directory block. Found while confirming that a GUIDELINE_GROUPS change produced no directory drift; reverted there to keep that PR's diff honest. Regenerate and commit these separately, and consider a CI check that fails when a clean 'tbd setup --auto' produces a diff.

## Notes

Half done in cc13b07 (PR #258): `tbd setup --auto` was run with the local dist build and
the regenerated surfaces committed — `.claude/skills/tbd/SKILL.md`,
`.agents/skills/tbd/SKILL.md`, `skills/tbd/SKILL.md`, `.claude/scripts/ensure-gh-cli.sh`,
`.codex/ensure-gh-cli.sh`. That PR also changed the guideline directory block (always-load
core trimmed to four documents), so the SKILL.md diffs carry both changes.

Still open: the drift check. A naive `setup --auto && git diff --exit-code` cannot work —
setup rewrites `.tbd/config.yml` with the running version and a timestamp, so on a dev
build it always reports a diff (and commits a `-dirty` version marker if you let it). The
check has to scope to the generated surfaces and exclude config.yml.
`ci-and-gates-rules` §"Generated Files Have Exactly One Owner" is the rule it implements.
