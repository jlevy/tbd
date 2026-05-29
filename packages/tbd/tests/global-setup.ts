/**
 * Vitest global setup — ensures dist/bin.mjs exists AND is up-to-date before E2E
 * tests run.
 *
 * Many tests spawn `node dist/bin.mjs` as a subprocess. Before this guard, a
 * stale dist/ would produce mysterious test failures because the tests run an
 * older build than the source they appear to be testing. Now we delegate to
 * `scripts/build-if-needed.mjs`, which compares mtimes of source/config files
 * vs. dist/bin.mjs and only rebuilds when something is actually newer.
 *
 * This fixes the footgun documented in tbd-zswv.
 */

import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageDir = dirname(__dirname);

export function setup() {
  // build-if-needed is a no-op when dist/ is up-to-date and runs pnpm build
  // otherwise. Inherit stdio so the user sees any build output (or errors)
  // before tests start.
  execSync('node scripts/build-if-needed.mjs', {
    cwd: packageDir,
    stdio: 'inherit',
  });
}
