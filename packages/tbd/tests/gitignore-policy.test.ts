/**
 * Guards the gitignore policy for agent integration files.
 *
 * Generated integration artifacts that travel with the repository (the portable
 * Agent Skill, the Claude mirror, AGENTS.md, Codex hooks and their per-agent
 * scripts, and the distribution skill) must NOT be gitignored, or `tbd setup`'s
 * dogfooded output would silently fail to be committed. Only regenerable caches
 * may be ignored.
 */

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const MONOREPO_ROOT = join(__dirname, '..', '..', '..');

/** Returns true if `git` reports the path as ignored at the repo root. */
function isIgnored(relPath: string): boolean {
  const result = spawnSync('git', ['check-ignore', '-q', relPath], { cwd: MONOREPO_ROOT });
  // Exit 0 = ignored, 1 = not ignored.
  return result.status === 0;
}

describe('gitignore policy for agent integration files', () => {
  it('does not ignore committed integration artifacts', () => {
    const mustBeTracked = [
      '.agents/skills/tbd/SKILL.md',
      '.claude/skills/tbd/SKILL.md',
      'AGENTS.md',
      '.codex/hooks.json',
      '.codex/tbd-session.sh',
      'skills/tbd/SKILL.md',
    ];
    for (const path of mustBeTracked) {
      expect(isIgnored(path), `${path} should not be gitignored`).toBe(false);
    }
  });

  it('still ignores regenerable caches', () => {
    expect(isIgnored('.tbd/docs/shortcuts/system/skill-baseline.md')).toBe(true);
  });
});
