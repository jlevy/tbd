/**
 * Vitest global setup — ensures dist/bin.mjs exists before E2E tests run.
 *
 * Many tests spawn `node dist/bin.mjs` as a subprocess and will fail with
 * MODULE_NOT_FOUND if the binary hasn't been built. This setup runs
 * `build-if-needed.mjs` so that `pnpm test` works without a manual `pnpm build`.
 */

import { stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageDir = dirname(__dirname);
const buildTarget = join(packageDir, 'dist', 'bin.mjs');

export async function setup() {
  try {
    await stat(buildTarget);
  } catch {
    console.log('\n[global-setup] dist/bin.mjs not found — running build...');
    execSync('pnpm build', { cwd: packageDir, stdio: 'inherit' });
  }
}
