/**
 * Release metadata must agree before a tag-triggered workflow reaches npm publish.
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  verifyReleaseArtifactVersion,
  verifyReleaseMetadata,
} from '../src/utils/release-metadata.js';

const CHANGELOG = ['# get-tbd', '', '## 1.2.3', '', '- A real release note', ''].join('\n');

describe('verifyReleaseMetadata', () => {
  it('returns the exact version and release body when all three sources agree', () => {
    expect(verifyReleaseMetadata('v1.2.3', '1.2.3', CHANGELOG)).toEqual({
      version: '1.2.3',
      releaseBody: ['## 1.2.3', '', '- A real release note'].join('\n'),
    });
  });

  it('rejects a tag without the required v prefix', () => {
    expect(() => verifyReleaseMetadata('1.2.3', '1.2.3', CHANGELOG)).toThrow(
      'Release tag must start with v',
    );
  });

  it('rejects a tag that does not match the package version', () => {
    expect(() => verifyReleaseMetadata('v1.2.4', '1.2.3', CHANGELOG)).toThrow(
      'Release tag v1.2.4 does not match package version 1.2.3',
    );
  });

  it('rejects a package version without an exact changelog section', () => {
    expect(() => verifyReleaseMetadata('v1.2.4', '1.2.4', CHANGELOG)).toThrow(
      'No changelog section found for version 1.2.4',
    );
  });
});

describe('verifyReleaseArtifactVersion', () => {
  it('accepts the exact compiled release version', () => {
    expect(() => {
      verifyReleaseArtifactVersion('1.2.3', '1.2.3');
    }).not.toThrow();
  });

  it('rejects a dirty development version baked into a release artifact', () => {
    expect(() => {
      verifyReleaseArtifactVersion('1.2.3', '1.2.4-dev.0.abc1234-dirty');
    }).toThrow('Built CLI reports 1.2.4-dev.0.abc1234-dirty, expected release version 1.2.3');
  });
});

describe('verify-release-metadata.ts', () => {
  const scriptPath = fileURLToPath(
    new URL('../scripts/verify-release-metadata.ts', import.meta.url),
  );

  it('fails before publish when package.json disagrees with the tag', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tbd-release-metadata-'));
    try {
      const packageJson = join(dir, 'package.json');
      const changelog = join(dir, 'CHANGELOG.md');
      writeFileSync(packageJson, JSON.stringify({ version: '1.2.3' }));
      writeFileSync(changelog, CHANGELOG);

      const result = spawnSync(
        process.execPath,
        ['--import', 'tsx', scriptPath, 'v1.2.4', packageJson, changelog],
        { encoding: 'utf-8' },
      );

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Release tag v1.2.4 does not match package version 1.2.3');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
