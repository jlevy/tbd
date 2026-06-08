/**
 * Unit tests for the "Shared lock writability" doctor finding (issue #164).
 *
 * A shared data-sync lock that tbd needs but cannot create (EPERM/EACCES) is a
 * fatal condition for write commands — it must surface as an error finding, with
 * agent-sandbox guidance when the Git common dir lives outside the checkout. The
 * EPERM path itself is not reproducible as root (CI runs as root, which bypasses
 * filesystem permissions), so the classification is exercised here as a pure
 * function; the happy path is covered end-to-end in doctor-lock-writability.e2e.
 */

import { describe, it, expect } from 'vitest';
import { join } from 'node:path';

import { buildLockWritabilityFinding } from '../src/cli/commands/doctor.js';
import { SharedLockUnwritableError } from '../src/file/common-dir-layout.js';
import { buildSharedTbdPaths, isCommonDirOutsideProject } from '../src/lib/paths.js';

const projectRoot = '/home/user/project';
const insideCommonDir = join(projectRoot, '.git');
const outsideCommonDir = '/home/user/original-repo/.git';

function findingParams(code: string | undefined, gitCommonDir: string) {
  const paths = buildSharedTbdPaths(gitCommonDir);
  return {
    code,
    sharedLockPath: paths.sharedLockPath,
    sharedLocksDir: paths.sharedLocksDir,
    sharedTbdDir: paths.sharedTbdDir,
    gitCommonDir: paths.gitCommonDir,
    projectRoot,
  };
}

describe('isCommonDirOutsideProject', () => {
  it('is false for the normal in-checkout .git', () => {
    expect(isCommonDirOutsideProject(insideCommonDir, projectRoot)).toBe(false);
  });

  it('is true when the common dir lives outside the checkout (linked worktree)', () => {
    expect(isCommonDirOutsideProject(outsideCommonDir, projectRoot)).toBe(true);
  });

  it('is false when the common dir equals the project root', () => {
    expect(isCommonDirOutsideProject(projectRoot, projectRoot)).toBe(false);
  });
});

describe('buildLockWritabilityFinding', () => {
  it('reports ok when the probe succeeded (no error code)', () => {
    const finding = buildLockWritabilityFinding(findingParams(undefined, insideCommonDir));
    expect(finding.status).toBe('ok');
    expect(finding.name).toBe('Shared lock writability');
    expect(finding.fixable).toBeUndefined();
  });

  it('reports a hard error for EPERM and points at the lock path', () => {
    const params = findingParams('EPERM', outsideCommonDir);
    const finding = buildLockWritabilityFinding(params);
    expect(finding.status).toBe('error');
    // Not auto-fixable: tbd cannot widen a sandbox or change FS permissions.
    expect(finding.fixable).toBeUndefined();
    expect(finding.message).toMatch(/EPERM/);
    expect(finding.path).toBe(params.sharedLockPath);
  });

  it('reports a hard error for EACCES', () => {
    const finding = buildLockWritabilityFinding(findingParams('EACCES', outsideCommonDir));
    expect(finding.status).toBe('error');
    expect(finding.message).toMatch(/EACCES/);
  });

  it('includes agent-sandbox guidance when the common dir is outside the checkout', () => {
    const finding = buildLockWritabilityFinding(findingParams('EPERM', outsideCommonDir));
    const text = [finding.message, finding.suggestion, ...(finding.details ?? [])].join('\n');
    expect(text).toMatch(/sandbox/i);
    expect(text).toMatch(/writable roots/i);
    expect(text).toMatch(/Codex/);
  });

  it('omits sandbox framing when the common dir is inside the checkout', () => {
    const finding = buildLockWritabilityFinding(findingParams('EPERM', insideCommonDir));
    const text = [finding.message, finding.suggestion, ...(finding.details ?? [])].join('\n');
    expect(finding.status).toBe('error');
    expect(text).not.toMatch(/writable roots/i);
    expect(text).toMatch(/permission/i);
  });

  it('reports an unrecognized probe failure as a warning, not a hard error', () => {
    const finding = buildLockWritabilityFinding(findingParams('EIO', insideCommonDir));
    expect(finding.status).toBe('warn');
    expect(finding.message).toMatch(/EIO/);
  });
});

describe('SharedLockUnwritableError', () => {
  it('uses sandbox wording when the common dir is outside the checkout', () => {
    const paths = buildSharedTbdPaths(outsideCommonDir);
    const err = new SharedLockUnwritableError('EPERM', paths, projectRoot);
    expect(err.name).toBe('SharedLockUnwritableError');
    expect(err.code).toBe('EPERM');
    expect(err.message).toContain(paths.sharedLockPath);
    expect(err.message).toContain(paths.sharedTbdDir);
    expect(err.message).toMatch(/sandbox/i);
    expect(err.message).toMatch(/writable roots/i);
    expect(err.message).toMatch(/tbd doctor/);
  });

  it('uses filesystem-permission wording when the common dir is inside the checkout', () => {
    const paths = buildSharedTbdPaths(insideCommonDir);
    const err = new SharedLockUnwritableError('EACCES', paths, projectRoot);
    expect(err.message).toContain(paths.sharedLockPath);
    expect(err.message).toMatch(/not writable by this process|filesystem permissions/i);
    expect(err.message).not.toMatch(/writable roots/i);
    expect(err.message).toMatch(/tbd doctor/);
  });
});
