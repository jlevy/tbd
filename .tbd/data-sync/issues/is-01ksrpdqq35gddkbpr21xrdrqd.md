---
type: is
id: is-01ksrpdqq35gddkbpr21xrdrqd
title: "[task] Phase 5: post-publish re-validate ATA, flowmark, and this repo with published v0.2.0"
kind: task
status: closed
priority: 1
version: 3
spec_path: tests/qa/release-v0.2.0-upgrade.qa.md
labels:
  - v0.2.0
dependencies: []
parent_id: is-01ksrpb7b8cfwrzzd34ya9874q
created_at: 2026-05-29T01:43:47.682Z
updated_at: 2026-05-29T06:31:32.518Z
closed_at: 2026-05-29T06:31:32.512Z
close_reason: "Phase 5 complete on published get-tbd@0.2.0 (npm install -g with --before=2099 --minimum-release-age=0 --userconfig=/dev/null override for our own release; tbd --version → 0.2.0; package at /Users/levy/.local/share/fnm/...; 30 shortcuts shipped, cut-release and tbd-format-versioning correctly absent). Validated: ATA (3548 issues, worktree healthy, sync OK); flowmark + sibling /private/tmp/flowmark-pr47-fresh (both healthy on shared layout); this repo (tbd shortcut --list / tbd guidelines --list / doctor all clean, no more f04 fail-closed). Dogfood pin refresh was a no-op — main already had 0.2.0 pins from the pre-release TBD_VERSION_OVERRIDE work. GH Release bodies for v0.2.0 and v0.1.30 both backfilled with the proper CHANGELOG sections via gh release edit; tbd-xk7c (release.yml awk fix) prevents this in future."
---
Per tests/qa/release-v0.2.0-upgrade.qa.md §5.

Steps:
- 'npm install -g get-tbd@0.2.0' (replace the local dev install)
- 'tbd --version' → '0.2.0'
- Re-run §5.2 against ai-trade-arena: tbd status / doctor / list / create / sync — no re-migration noise, no surprise tracked diffs
- Re-run §5.3 against flowmark and its /private/tmp siblings
- §5.4: 'tbd shortcut --list' and 'tbd guidelines --list' work in this repo (they currently fail-closed on global v0.1.30 because this repo is f04)

Update playbook status table to ✅ on success.

## Notes

Additional step (added 2026-05-28): after the global v0.2.0 swap, run 'tbd setup --auto' in /Users/levy/wrk/github/tbd to regenerate the repo-root agent integration files (.agents/skills/tbd/SKILL.md, .claude/scripts/tbd-session.sh, .claude/skills/tbd/SKILL.md, .codex/tbd-session.sh, AGENTS.md). With v0.2.0 installed, the pinned npx fallback in these files should resolve to '0.2.0' instead of the moving '0.1.31-dev.N.SHA' pin. Commit as 'chore: refresh dogfood agent integration pins to v0.2.0'. These files are at the repo root and NOT in the npm package (packages/tbd/package.json files: [dist]), so this is strictly post-publish cleanup, not a release blocker.
