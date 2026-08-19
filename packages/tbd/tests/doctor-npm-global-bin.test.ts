/**
 * Unit tests for the "npm global bin" doctor finding.
 *
 * tbd's install and upgrade instruction is `npm install -g get-tbd@latest`. When npm's
 * global bin directory is not on PATH that command exits 0 and leaves the binary
 * unresolvable, so doctor has to name the PATH problem rather than let an agent
 * conclude the CLI is broken.
 */

import { describe, it, expect } from 'vitest';

import { classifyNpmGlobalBin } from '../src/cli/commands/doctor.js';
import { isDirOnPath, npmGlobalBinDir } from '../src/lib/npm-global-bin.js';

describe('npmGlobalBinDir', () => {
  it('appends bin to the prefix on POSIX platforms', () => {
    expect(npmGlobalBinDir('/usr/local', 'linux')).toBe('/usr/local/bin');
    expect(npmGlobalBinDir('/home/agent/.local', 'darwin')).toBe('/home/agent/.local/bin');
  });

  it('uses the prefix itself on Windows, where npm puts shims at the top level', () => {
    expect(npmGlobalBinDir('C:\\npm-global', 'win32')).toBe('C:\\npm-global');
  });
});

describe('isDirOnPath', () => {
  it('matches an exact entry', () => {
    expect(isDirOnPath('/usr/local/bin', '/usr/bin:/usr/local/bin:/bin', 'linux')).toBe(true);
  });

  it('ignores a trailing separator difference', () => {
    expect(isDirOnPath('/usr/local/bin', '/usr/local/bin/:/bin', 'linux')).toBe(true);
  });

  it('rejects a directory that is merely a prefix of an entry', () => {
    expect(isDirOnPath('/usr/local/bin', '/usr/local/bin-other:/bin', 'linux')).toBe(false);
  });

  it('reports false for an absent or empty PATH', () => {
    expect(isDirOnPath('/usr/local/bin', undefined, 'linux')).toBe(false);
    expect(isDirOnPath('/usr/local/bin', '', 'linux')).toBe(false);
  });

  it('skips empty PATH entries rather than treating them as the working directory', () => {
    expect(isDirOnPath('/usr/local/bin', ':/bin:', 'linux')).toBe(false);
  });

  // These pin platform semantics to the argument rather than the host, so the
  // cross-platform CI matrix gets the same answers from every runner.
  it('splits a Windows PATH on ; and compares case-insensitively', () => {
    expect(isDirOnPath('C:\\npm-global', 'C:\\Windows;C:\\npm-global', 'win32')).toBe(true);
    expect(isDirOnPath('C:\\NPM-Global', 'C:\\npm-global', 'win32')).toBe(true);
  });

  it('splits a POSIX PATH on : even when the host separator differs', () => {
    expect(isDirOnPath('/usr/local/bin', '/usr/bin:/usr/local/bin', 'linux')).toBe(true);
    expect(isDirOnPath('/usr/local/bin', '/usr/bin;/usr/local/bin', 'linux')).toBe(false);
  });

  it('keeps POSIX comparisons case-sensitive', () => {
    expect(isDirOnPath('/usr/local/BIN', '/usr/local/bin', 'linux')).toBe(false);
  });
});

describe('classifyNpmGlobalBin', () => {
  it('is quiet when the global bin directory is on PATH', () => {
    const diag = classifyNpmGlobalBin('/home/agent/.local', '/home/agent/.local/bin:/bin', 'linux');
    expect(diag.status).toBe('ok');
    expect(diag.path).toBe('/home/agent/.local/bin');
  });

  it('warns and names the unreachable directory when it is off PATH', () => {
    // The container shape that motivated this check: a pinned Node unpacked into its
    // own tree, whose bin/ is reached only through symlinks elsewhere on PATH.
    const diag = classifyNpmGlobalBin(
      '/home/agent/.local/lib/nodejs/node-v24.18.0-linux-x64',
      '/home/agent/.local/bin:/usr/bin',
      'linux',
    );
    expect(diag.status).toBe('warn');
    expect(diag.path).toBe('/home/agent/.local/lib/nodejs/node-v24.18.0-linux-x64/bin');
    expect(diag.suggestion).toMatch(/npm install -g get-tbd/);
    expect(diag.suggestion).toMatch(/npm config set prefix/);
  });

  it('treats a missing npm as nothing to check rather than a failure', () => {
    const diag = classifyNpmGlobalBin(null, '/usr/bin', 'linux');
    expect(diag.status).toBe('ok');
    expect(diag.message).toMatch(/npm not available/);
  });
});
