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
import { homedir } from 'node:os';

/**
 * Format version stamped into every generated agent integration artifact (e.g.
 * the AGENTS.md managed block's begin marker: `... format=f02 surface=...`).
 *
 * Uses the same `fNN` convention as tbd's repo data format (`tbd_format`), but is
 * a SEPARATE counter — bump it only when the *shape* of generated agent surfaces
 * changes, so setup can detect older generated content and upgrade it in place. A
 * running tbd that encounters an artifact stamped with a HIGHER format than this
 * must refuse to overwrite it and tell the user to upgrade tbd. The pre-versioning
 * full AGENTS.md block (a marked block with no `format=` field) is treated as f01.
 */
export const AGENT_INTEGRATION_FORMAT = 'f02';

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
// Shared Agent Scripts (neutral location, referenced by every agent's hooks)
// =============================================================================

/**
 * Neutral directory for hook scripts shared across agents. Kept out of
 * `.claude/` so Codex hooks never depend on Claude Code setup.
 */
export const AGENT_SCRIPTS_DIR_REL = 'scripts/agent';

/**
 * Shared session bootstrap script (runs `tbd prime`).
 */
export const SHARED_SESSION_SCRIPT_REL = 'scripts/agent/tbd-session.sh';

/**
 * Shared close-protocol reminder script.
 */
export const SHARED_CLOSING_REMINDER_REL = 'scripts/agent/tbd-closing-reminder.sh';

/**
 * Shared gh CLI ensure script.
 */
export const SHARED_GH_CLI_SCRIPT_REL = 'scripts/agent/ensure-gh-cli.sh';

// =============================================================================
// Global Paths (for detection only - NOT for installation)
// =============================================================================

/**
 * Global Claude Code directory in user's home.
 * Used ONLY for detecting if Claude Code is installed (for agent detection).
 * All installations are project-local.
 */
export const GLOBAL_CLAUDE_DIR = join(homedir(), '.claude');

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
    /** .agents/skills/tbd/SKILL.md — canonical portable install */
    portable: join(projectRoot, AGENTS_SKILL_REL),
    /** .claude/skills/tbd/SKILL.md — Claude Code mirror */
    claudeMirror: join(projectRoot, CLAUDE_SKILL_REL),
    /** skills/tbd/SKILL.md — distribution copy */
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

/**
 * Get shared agent script paths (neutral location used by every agent's hooks).
 *
 * @param projectRoot - The project root directory
 */
export function getSharedScriptPaths(projectRoot: string) {
  return {
    /** scripts/agent/ directory */
    dir: join(projectRoot, AGENT_SCRIPTS_DIR_REL),
    /** scripts/agent/tbd-session.sh */
    sessionScript: join(projectRoot, SHARED_SESSION_SCRIPT_REL),
    /** scripts/agent/tbd-closing-reminder.sh */
    closingReminder: join(projectRoot, SHARED_CLOSING_REMINDER_REL),
    /** scripts/agent/ensure-gh-cli.sh */
    ghCliScript: join(projectRoot, SHARED_GH_CLI_SCRIPT_REL),
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
