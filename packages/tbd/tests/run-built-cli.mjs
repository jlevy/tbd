/** Shell-neutral launcher for sandboxed tryscript coverage of the built CLI. */

import { resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const packageRoot = process.env.TRYSCRIPT_PACKAGE_ROOT;
if (packageRoot === undefined || packageRoot === '') {
  throw new Error('TRYSCRIPT_PACKAGE_ROOT is required to locate the built CLI');
}

const entry = resolve(packageRoot, 'dist', 'bin.mjs');
process.argv[1] = entry;
await import(pathToFileURL(entry).href);
