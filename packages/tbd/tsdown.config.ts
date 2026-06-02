import { readFileSync } from 'node:fs';

import { defineConfig } from 'tsdown';

// Import git version detection from shared script (not distributed with package)
import { getGitVersion } from './scripts/git-version.mjs';

// Full git-describe version, used for display/diagnostics (e.g. `tbd --version`).
const version = getGitVersion();

// Clean published semver from package.json, used for pinned `get-tbd@<version>`
// fallbacks (e.g. the session script). Unlike `version`, this is never a
// dev/dirty git-describe string — that would not be installable from npm and
// would churn generated files on every local build.
const pinnedVersion = (
  JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
    version: string;
  }
).version;

// Common options for ESM-only build
const commonOptions = {
  format: ['esm'] as 'esm'[],
  platform: 'node' as const,
  target: 'node20' as const,
  sourcemap: true,
  dts: true,
  define: {
    __TBD_VERSION__: JSON.stringify(version),
    __TBD_PINNED_VERSION__: JSON.stringify(pinnedVersion),
  },
};

export default defineConfig([
  // Library entry points
  {
    ...commonOptions,
    entry: {
      index: 'src/index.ts',
      cli: 'src/cli/cli.ts',
    },
    clean: true,
  },
  // CLI binary - ESM entry (used by bootstrap)
  // Bundle all dependencies for faster startup (no node_modules resolution at runtime)
  {
    ...commonOptions,
    entry: { bin: 'src/cli/bin.ts' },
    banner: '#!/usr/bin/env node',
    clean: false,
    noExternal: [
      'yaml',
      'commander',
      'picocolors',
      'marked',
      'marked-terminal',
      'atomically',
      'ulid',
      'github-slugger',
      'zod',
    ],
    // Acknowledge intentional dependency bundling (suppresses tsdown 0.20+ warning)
    inlineOnly: false,
  },
  // CLI bootstrap - CJS entry that enables compile cache before loading ESM
  {
    format: ['cjs'] as 'cjs'[],
    platform: 'node' as const,
    target: 'node20' as const,
    sourcemap: true,
    dts: false,
    entry: { 'bin-bootstrap': 'src/cli/bin-bootstrap.cjs' },
    banner: '#!/usr/bin/env node',
    clean: false,
  },
]);
