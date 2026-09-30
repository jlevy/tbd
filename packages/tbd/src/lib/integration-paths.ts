/**
 * Centralized path constants and utilities for coding agent integrations.
 *
 * IMPORTANT: All tbd integration files (skills, hooks, settings, scripts) are
 * installed to PROJECT-LOCAL directories (.agents/, .claude/, .codex/,
 * scripts/agent/, AGENTS.md) ONLY. We do NOT install to global/user directories
 * (~/.claude/, ~/.codex/, ~/.agents/).
 *
 * This file defines all path constants in one place to:
 * 1. Ensure consistency across the codebase
 * 2. Make the project-local policy explicit and auditable
 * 3. Simplify future changes to path conventions
 */

import { join } from 'node:path';

/**
 * Format stamped into generated agent integration surfaces: the AGENTS.md
 * managed block's begin marker (`<!-- BEGIN TBD INTEGRATION format=f100
 * surface=agents-md -->`) and the DO NOT EDIT marker of every generated
 * SKILL.md. It is a compatibility gate for those surfaces only.
 *
 * SEPARATE from the repository format (`CURRENT_FORMAT` in tbd-format.ts, the
 * `tbd_format` in .tbd/config.yml). Through tbd 0.9.0 this constant aliased
 * `CURRENT_FORMAT`, so the two series share the values f01 through f08. They
 * were split so that a generated surface can gain content an older release must
 * not rewrite (the policy grants block inside the AGENTS.md block) without
 * migrating every repository and without spending f09, which
 * docs/tbd-format-versioning.md reserves for the native-comments repository
 * format.
 *
 * Values: the integration series continues at f100 and counts up by one (f100,
 * f101, ...). Every reader, old and new, parses `format=f(\d+)` and compares
 * the number (see managed-artifact.ts), so a pre-split release, whose ceiling
 * is a two-digit repository format, refuses any three-digit stamp and prints
 * the upgrade message instead of rewriting the surface. The width also keeps
 * the two series apart for a human reader: two digits is a repository format,
 * three digits is an integration format. No three-digit value is a key of
 * FORMAT_HISTORY, so none can be accepted as a repository format.
 *
 * A marked AGENTS.md block with no `format=` field predates stamping and is
 * read as f01; any stamp at or below this constant is rewritten in place.
 *
 * History:
 * - f01..f08: aliased the repository format (tbd through 0.9.0).
 * - f100: split from the repository format; the AGENTS.md block may carry a
 *   policy grants block that older releases must not delete.
 *
 * Bump this constant, not CURRENT_FORMAT, when a generated surface changes so
 * that an older release rewriting it would lose data or break the surface. See
 * docs/tbd-format-versioning.md, "Generated Integration Format".
 */
export const AGENT_INTEGRATION_FORMAT = 'f100';

// =============================================================================
// Claude Code Integration Paths (project-local)
// =============================================================================

/**
 * Relative path to Claude Code settings file from project root.
 * This is where hooks are configured.
 */
export const CLAUDE_SETTINGS_REL = '.claude/settings.json';

/**
 * Relative path to Claude Code directory from project root.
 */
export const CLAUDE_DIR_REL = '.claude';

/**
 * Relative path to Claude Code scripts directory from project root.
 */
export const CLAUDE_SCRIPTS_DIR_REL = '.claude/scripts';

/**
 * Relative path to Claude Code hooks directory from project root.
 */
export const CLAUDE_HOOKS_DIR_REL = '.claude/hooks';

/**
 * Relative path to tbd skill file from project root.
 */
export const CLAUDE_SKILL_REL = '.claude/skills/tbd/SKILL.md';

/**
 * Relative path to tbd session script from project root.
 */
export const TBD_SESSION_SCRIPT_REL = '.claude/scripts/tbd-session.sh';

/**
 * Relative path to tbd closing reminder hook script from project root.
 */
export const TBD_CLOSING_REMINDER_REL = '.claude/hooks/tbd-closing-reminder.sh';

/**
 * Relative path to gh CLI ensure script from project root.
 */
export const GH_CLI_SCRIPT_REL = '.claude/scripts/ensure-gh-cli.sh';

// =============================================================================
// Portable Agent Skills Integration Paths (project-local)
// =============================================================================

/**
 * Canonical portable project Agent Skill, scanned by Codex, Gemini CLI, Cursor,
 * GitHub Copilot, Amp, OpenCode, pi, and other Agent Skills clients.
 */
export const AGENTS_SKILL_REL = '.agents/skills/tbd/SKILL.md';

/**
 * Repository distribution copy of the skill, for skills.sh-style installers
 * (`npx skills add`) and direct GitHub browsing.
 */
export const SKILLS_DIST_REL = 'skills/tbd/SKILL.md';

// =============================================================================
// Codex / AGENTS.md Integration Paths (project-local)
// =============================================================================

/**
 * Relative path to AGENTS.md file from project root.
 * Used by Codex, Factory.ai, Cursor (v1.6+), and other compatible tools.
 */
export const AGENTS_MD_REL = 'AGENTS.md';

/**
 * Codex project-local config/hook directory.
 */
export const CODEX_DIR_REL = '.codex';

/**
 * Codex project-local hooks file (Claude-compatible event schema).
 */
export const CODEX_HOOKS_REL = '.codex/hooks.json';

/**
 * Codex project-local config; may also carry an inline `[hooks]` table.
 */
export const CODEX_CONFIG_REL = '.codex/config.toml';

// =============================================================================
// Tier Agent Definition Paths (project-local)
// =============================================================================

/**
 * Claude Code project agent definitions directory. `tbd setup` writes the
 * generated tier definitions (`tbd-*.md`) here and never to `~/.claude/agents/`:
 * a user-level definition appears in every project's agent list, so it would
 * carry one project's instructions into every other project's sessions.
 */
export const CLAUDE_AGENTS_DIR_REL = '.claude/agents';

/**
 * Codex project custom agents directory; the generated tier definitions are
 * `tbd-*.toml`. Project-scoped for the same reason as the Claude Code ones.
 */
export const CODEX_AGENTS_DIR_REL = '.codex/agents';

/** The two platforms that get generated tier agent definitions. */
export type TierAgentPlatform = 'claude' | 'codex';

/** Relative path of one generated tier agent definition, by platform and name. */
export function getTierAgentRel(platform: TierAgentPlatform, name: string): string {
  return platform === 'claude'
    ? `${CLAUDE_AGENTS_DIR_REL}/${name}.md`
    : `${CODEX_AGENTS_DIR_REL}/${name}.toml`;
}

/** Display path for a platform's generated tier definitions in doctor output. */
export const TIER_AGENTS_DISPLAY: Record<TierAgentPlatform, string> = {
  claude: `${CLAUDE_AGENTS_DIR_REL}/tbd-*.md`,
  codex: `${CODEX_AGENTS_DIR_REL}/tbd-*.toml`,
};

// Note on hook scripts: each agent surface writes its own copy of the hook
// scripts under its own directory (Claude Code under `.claude/scripts/` and
// Codex under `.codex/`) rather than sharing a single neutral `scripts/agent/`
// copy. Per-agent copies keep each surface self-contained: Codex hooks never
// reference `.claude/`, so Codex setup does not depend on Claude Code setup.
// (See cli-agent-skill-patterns §6.6: per-agent copies are a valid alternative
// to a shared neutral script.)

// =============================================================================
// Path Resolution Utilities
// =============================================================================

/**
 * Get project-local Claude Code paths.
 *
 * @param projectRoot - The project root directory (containing .tbd/)
 * @returns Object with all Claude Code paths resolved to absolute paths
 */
export function getClaudePaths(projectRoot: string) {
  return {
    /** .claude/ directory */
    dir: join(projectRoot, CLAUDE_DIR_REL),
    /** .claude/settings.json */
    settings: join(projectRoot, CLAUDE_SETTINGS_REL),
    /** .claude/scripts/ directory */
    scriptsDir: join(projectRoot, CLAUDE_SCRIPTS_DIR_REL),
    /** .claude/hooks/ directory */
    hooksDir: join(projectRoot, CLAUDE_HOOKS_DIR_REL),
    /** .claude/skills/tbd/SKILL.md */
    skill: join(projectRoot, CLAUDE_SKILL_REL),
    /** .claude/scripts/tbd-session.sh */
    sessionScript: join(projectRoot, TBD_SESSION_SCRIPT_REL),
    /** .claude/hooks/tbd-closing-reminder.sh */
    closingReminder: join(projectRoot, TBD_CLOSING_REMINDER_REL),
    /** .claude/scripts/ensure-gh-cli.sh */
    ghCliScript: join(projectRoot, GH_CLI_SCRIPT_REL),
  };
}

/**
 * Get project-local Codex/AGENTS.md path.
 *
 * @param projectRoot - The project root directory
 * @returns Absolute path to AGENTS.md
 */
export function getAgentsMdPath(projectRoot: string): string {
  return join(projectRoot, AGENTS_MD_REL);
}

/**
 * Get the three SKILL.md targets: the portable Agent Skills install, the Claude
 * Code mirror, and the committed distribution copy.
 *
 * @param projectRoot - The project root directory (containing .tbd/)
 */
export function getAgentSkillPaths(projectRoot: string) {
  return {
    /** .agents/skills/tbd/SKILL.md: canonical portable install */
    portable: join(projectRoot, AGENTS_SKILL_REL),
    /** .claude/skills/tbd/SKILL.md: Claude Code mirror */
    claudeMirror: join(projectRoot, CLAUDE_SKILL_REL),
    /** skills/tbd/SKILL.md: distribution copy */
    distribution: join(projectRoot, SKILLS_DIST_REL),
  };
}

/**
 * Get project-local Codex config/hook paths.
 *
 * @param projectRoot - The project root directory
 */
export function getCodexPaths(projectRoot: string) {
  return {
    /** .codex/ directory */
    dir: join(projectRoot, CODEX_DIR_REL),
    /** .codex/hooks.json */
    hooks: join(projectRoot, CODEX_HOOKS_REL),
    /** .codex/config.toml */
    config: join(projectRoot, CODEX_CONFIG_REL),
  };
}

// =============================================================================
// Display Paths (for user-facing output)
// =============================================================================

/**
 * Display path for Claude Code settings in status/doctor output.
 */
export const CLAUDE_SETTINGS_DISPLAY = './.claude/settings.json';

/**
 * Display path for AGENTS.md in status/doctor output.
 */
export const AGENTS_MD_DISPLAY = './AGENTS.md';

/**
 * Display path for the portable Agent Skill in status/doctor output.
 */
export const AGENTS_SKILL_DISPLAY = './.agents/skills/tbd/SKILL.md';

/**
 * Display path for the Claude Code skill mirror in status/doctor output.
 */
export const CLAUDE_SKILL_DISPLAY = './.claude/skills/tbd/SKILL.md';

/**
 * Display path for the Codex hooks file in status/doctor output.
 */
export const CODEX_HOOKS_DISPLAY = './.codex/hooks.json';

/**
 * Display path for the distribution skill copy in status/doctor output.
 */
export const SKILLS_DIST_DISPLAY = './skills/tbd/SKILL.md';
