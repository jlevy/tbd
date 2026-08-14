/** Runtime-floor tests for the CommonJS CLI bootstrap. */

import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { MINIMUM_NODE_VERSION, supportsNodeVersion } = require('../src/cli/bin-bootstrap.cjs') as {
  MINIMUM_NODE_VERSION: string;
  supportsNodeVersion: (version: string) => boolean;
};

describe('CLI Node.js runtime floor', () => {
  it('matches the package engine and accepts supported versions', async () => {
    const [packageJsonText, workspacePackageJsonText] = await Promise.all([
      readFile(new URL('../package.json', import.meta.url), 'utf8'),
      readFile(new URL('../../../package.json', import.meta.url), 'utf8'),
    ]);
    const packageJson = JSON.parse(packageJsonText) as { engines: { node: string } };
    const workspacePackageJson = JSON.parse(workspacePackageJsonText) as {
      engines: { node: string };
    };

    expect(MINIMUM_NODE_VERSION).toBe('22.12.0');
    expect(packageJson.engines.node).toBe(`>=${MINIMUM_NODE_VERSION}`);
    expect(workspacePackageJson.engines.node).toBe(packageJson.engines.node);
    expect(supportsNodeVersion('22.12.0')).toBe(true);
    expect(supportsNodeVersion('22.12.0+local')).toBe(true);
    expect(supportsNodeVersion('22.12.1')).toBe(true);
    expect(supportsNodeVersion('24.0.0')).toBe(true);
    expect(supportsNodeVersion('26.0.0')).toBe(true);
  });

  it('rejects older and malformed versions', () => {
    expect(supportsNodeVersion('20.19.0')).toBe(false);
    expect(supportsNodeVersion('22.11.0')).toBe(false);
    expect(supportsNodeVersion('22.12.0-rc.1')).toBe(false);
    expect(supportsNodeVersion('not-a-version')).toBe(false);
  });
});
