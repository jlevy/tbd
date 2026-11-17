/**
 * The ref-free remote reads behind `tbd sync --status` and `tbd watch`: choosing the
 * exact branch from `ls-remote` output, and quoting the line of a git failure that
 * names its cause.
 */

import { describe, expect, it } from 'vitest';

import { describeGitFailure, findRemoteTip, GitError, parseRemoteTip } from '../src/file/git.js';

const TIP = 'ac43e18b3fe0f1d2c3b4a5968778695a4b3c2d1e';
const DECOY = '40d0590a1b2c3d4e5f60718293a4b5c6d7e8f901';

function gitFailure(stderr: string): GitError {
  return new GitError('Command failed: git ls-remote', {
    exitCode: 128,
    stderr,
    stdout: '',
    args: ['ls-remote'],
  });
}

describe('findRemoteTip', () => {
  // `git ls-remote <remote> refs/heads/tbd-sync` matches a path suffix, and prints this
  // decoy before the branch itself (protocol v0 and v2).
  const output = `${DECOY}\trefs/heads/a/refs/heads/tbd-sync\n${TIP}\trefs/heads/tbd-sync\n`;

  it('takes the line whose ref is exactly refs/heads/<branch>', () => {
    expect(findRemoteTip(output, 'tbd-sync')).toBe(TIP);
    expect(parseRemoteTip(output, 'origin', 'tbd-sync')).toBe(TIP);
  });

  it('finds no tip when only a suffix match is listed', () => {
    const decoyOnly = `${DECOY}\trefs/heads/a/refs/heads/tbd-sync\n`;
    expect(findRemoteTip(decoyOnly, 'tbd-sync')).toBeNull();
    expect(() => parseRemoteTip(decoyOnly, 'origin', 'tbd-sync')).toThrow(
      'Remote sync branch not found: origin/tbd-sync',
    );
  });
});

describe('describeGitFailure', () => {
  it('quotes the first fatal or error line, not a warning or banner before it', () => {
    const ssh =
      "Warning: Permanently added '127.0.0.1' (ED25519) to the list of known hosts.\r\n" +
      'fatal: Could not read from remote repository.\n\n' +
      'Please make sure you have the correct access rights\nand the repository exists.\n';
    expect(describeGitFailure(gitFailure(ssh))).toBe(
      'fatal: Could not read from remote repository.',
    );
    expect(
      describeGitFailure(gitFailure('error: Server does not allow request\nfatal: early EOF\n')),
    ).toBe('error: Server does not allow request');
  });

  it('falls back to the last non-empty line, with control characters removed', () => {
    expect(
      describeGitFailure(gitFailure('Welcome to the server\n\u001b[31mconnection closed‮\n\n')),
    ).toBe('[31mconnection closed');
    expect(describeGitFailure(new Error('spawn git ENOENT'))).toBe('spawn git ENOENT');
  });
});
