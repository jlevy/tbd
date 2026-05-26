---
'get-tbd': minor
---
Modernize multi-agent skills and hooks setup.

`tbd setup --auto` now installs the portable Agent Skill at
`.agents/skills/tbd/SKILL.md` (the cross-agent standard path read by Codex, Gemini CLI,
Cursor, Copilot, Amp, OpenCode, and others) and mirrors the identical payload to
`.claude/skills/tbd/SKILL.md` for Claude Code.

- **Codex hooks**: setup writes `.codex/hooks.json` plus Codex-native scripts
  (SessionStart/PreCompact run `tbd prime`, PostToolUse reminds about `tbd sync` after
  `git push`, optional SessionStart ensures `gh`). Codex hooks reference only `.codex/`,
  never `.claude/`.
- **Compact AGENTS.md block**: the managed `AGENTS.md` section is now a short bootstrap
  that points to `tbd prime`/`tbd skill`/`tbd shortcut --list`/ `tbd guidelines --list`
  instead of embedding the full skill.
- **Format-version guard**: generated artifacts carry an integration-format stamp.
  Setup self-upgrades older blocks in place, but refuses to overwrite an artifact
  written by a newer tbd, telling you to run `npm install -g get-tbd@latest`. This makes
  version pinning safe across a team.
- **Pinned runner fallback**: generated session scripts are local-first, then a
  version-pinned `npx get-tbd@<version>` fallback (never unpinned).
- **Agent-targeting flags**: `--all`, `--claude`, `--codex`, `--skip-claude`,
  `--skip-codex`.
- **Distribution copy**: a committed `skills/tbd/SKILL.md` for skills.sh-style
  installers (`npx skills add`) and GitHub browsing.
- `tbd doctor` and `tbd status` now report all of these surfaces.

Backwards compatible: existing Claude Code installs keep working and are upgraded in
place on the next `tbd setup --auto`.
