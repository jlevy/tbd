/**
 * Unit tests for the "npm global bin" doctor finding.
 *
 * tbd's install and upgrade instruction is `npm install -g get-tbd@latest`. When npm's
 * global bin directory is not on PATH that command exits 0 and leaves the binary
 * unresolvable, so doctor has to name the PATH problem rather than let an agent
 * conclude the CLI is broken.
 */

import { describe, it, expect } from 'vitest';

import { classifyNpmGlobalBin, shouldReportNpmGlobalBin } from '../src/cli/commands/doctor.js';
import { isDirOnPath, npmGlobalBinDir, npmPrefixCommand } from '../src/lib/npm-global-bin.js';

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

  it('matches a quoted Windows entry, which resolve would otherwise keep quoted', () => {
    // A quoted entry that failed to match would make doctor advise adding a directory
    // that is already on PATH. Wrong advice is worse than none.
    expect(
      isDirOnPath('C:\\Program Files\\nodejs', '"C:\\Program Files\\nodejs";C:\\Windows', 'win32'),
    ).toBe(true);
  });

  it('leaves quotes alone on POSIX, where they are literal filename characters', () => {
    expect(isDirOnPath('/opt/bin', '"/opt/bin"', 'linux')).toBe(false);
  });
});

describe('npmPrefixCommand', () => {
  // On Windows npm is npm.cmd, which CreateProcess cannot launch, so execFile fails with
  // ENOENT. Left unrouted, the whole check degrades to a permanent silent no-op there --
  // on the one platform whose global bin layout actually differs. No test spawns npm, so
  // a green Windows job would not have caught it either.
  it('routes through cmd.exe on Windows so npm.cmd is launchable', () => {
    expect(npmPrefixCommand('win32')).toEqual({
      file: 'cmd.exe',
      args: ['/d', '/s', '/c', 'npm', 'prefix', '-g'],
    });
  });

  it('invokes npm directly on POSIX platforms', () => {
    for (const platform of ['linux', 'darwin'] as const) {
      expect(npmPrefixCommand(platform)).toEqual({ file: 'npm', args: ['prefix', '-g'] });
    }
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

describe('shouldReportNpmGlobalBin', () => {
  it('omits the finding on a healthy machine and on a host without npm', () => {
    expect(
      shouldReportNpmGlobalBin(
        classifyNpmGlobalBin('/home/agent/.local', '/home/agent/.local/bin:/bin', 'linux'),
      ),
    ).toBe(false);
    expect(shouldReportNpmGlobalBin(classifyNpmGlobalBin(null, '/usr/bin', 'linux'))).toBe(false);
  });

  it('surfaces the finding when the global bin directory is unreachable', () => {
    expect(shouldReportNpmGlobalBin(classifyNpmGlobalBin('/opt/node', '/usr/bin', 'linux'))).toBe(
      true,
    );
  });

  it('surfaces a check that errored, so a failure to probe is never swallowed', () => {
    expect(
      shouldReportNpmGlobalBin({ name: 'npm global bin', status: 'error', message: 'boom' }),
    ).toBe(true);
  });
});
