/* global __dirname, console, process */
/**
 * CLI bootstrap entry point (CommonJS).
 *
 * This file MUST be CommonJS so it executes before any ESM module loading.
 * It enables Node's compile cache for faster subsequent runs, then loads the real CLI.
 *
 * Why CJS? ESM static imports are resolved before module code runs, so calling
 * enableCompileCache() in an ESM file is "too late" - the heavy deps are already
 * being parsed. A CJS bootstrap lets us enable caching BEFORE the ESM import.
 */
'use strict';

const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MINIMUM_NODE_VERSION = '22.12.0';
const MINIMUM_NODE_PARTS = MINIMUM_NODE_VERSION.split('.').map(Number);

/** Whether a Node version string satisfies the CLI's runtime floor. */
function supportsNodeVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)([-+][0-9A-Za-z.-]+)?$/u.exec(version);
  if (match === null) {
    return false;
  }

  const current = match.slice(1, 4).map(Number);
  for (let index = 0; index < MINIMUM_NODE_PARTS.length; index += 1) {
    if (current[index] !== MINIMUM_NODE_PARTS[index]) {
      return current[index] > MINIMUM_NODE_PARTS[index];
    }
  }
  return !match[4]?.startsWith('-');
}

function startCli() {
  if (!supportsNodeVersion(process.versions.node)) {
    console.error(
      `tbd requires Node.js ${MINIMUM_NODE_VERSION} or newer; current runtime is ${process.versions.node}. Upgrade Node.js before running tbd.`,
    );
    process.exitCode = 1;
    return;
  }

  // Enable compile cache BEFORE loading any ESM modules.
  // This caches compiled bytecode on disk for faster subsequent runs.
  try {
    const mod = require('node:module');
    mod.enableCompileCache();
  } catch {
    // Caching is an optimization, not required.
  }

  // Load the bundled CLI binary (ESM with all deps bundled for fast startup).
  // bin.mjs runs runCli() as a side effect when imported.
  const binPath = path.join(__dirname, 'bin.mjs');
  import(pathToFileURL(binPath).href);
}

if (require.main === module) {
  startCli();
}

module.exports = { MINIMUM_NODE_VERSION, supportsNodeVersion };
