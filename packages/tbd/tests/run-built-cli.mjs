/** Shell-neutral launcher for sandboxed tryscript coverage of the built CLI. */

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import process from 'node:process';

const packageRoot = process.env.TRYSCRIPT_PACKAGE_ROOT;
if (packageRoot === undefined || packageRoot === '') {
  throw new Error('TRYSCRIPT_PACKAGE_ROOT is required to locate the built CLI');
}

const entry = resolve(packageRoot, 'dist', 'bin.mjs');
const child = spawnSync(process.execPath, [entry, ...process.argv.slice(2)], {
  stdio: 'inherit',
  windowsHide: true,
});
if (child.error !== undefined) {
  throw child.error;
}
process.exitCode = child.status ?? 1;
