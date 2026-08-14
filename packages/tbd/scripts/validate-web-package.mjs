#!/usr/bin/env node
/* global clearTimeout, console, fetch, process, setTimeout */

/** Prove the packed npm artifact can launch and serve its self-contained web page. */

import { execFile, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { access, mkdir, mkdtemp, readFile, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageDir = join(scriptDir, '..');
const sourceRepoDir = join(packageDir, '..', '..');

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function packArchive(destination) {
  const args = ['pack', '--pack-destination', destination];
  if (process.platform === 'win32') {
    // pnpm is a .cmd shim on Windows, so execFile cannot launch it directly.
    await execFileAsync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/c', 'pnpm.cmd', ...args], {
      cwd: packageDir,
      windowsHide: true,
    });
    return;
  }
  await execFileAsync('pnpm', args, { cwd: packageDir });
}

async function repositoryStatus(directory) {
  const { stdout } = await execFileAsync(
    'git',
    ['status', '--porcelain=v1', '--untracked-files=all'],
    { cwd: directory },
  );
  return stdout;
}

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  invariant(address !== null && typeof address !== 'string', 'Expected a TCP address');
  const port = address.port;
  await new Promise((resolve) => {
    server.close(resolve);
  });
  return port;
}

function waitForDescriptor(child) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      reject(new Error(`Packed tbd web did not become ready\n${stdout}\n${stderr}`));
    }, 15_000);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      try {
        const descriptor = JSON.parse(stdout);
        clearTimeout(timer);
        resolve(descriptor);
      } catch {
        // The descriptor is pretty-printed and may span chunks.
      }
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      reject(
        new Error(
          `Packed tbd web exited before readiness (code ${code}, signal ${signal})\n` +
            `${stdout}\n${stderr}`,
        ),
      );
    });
  });
}

function waitForExit(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve({ code: child.exitCode, signal: child.signalCode });
  }
  return new Promise((resolve) => {
    child.once('exit', (code, signal) => {
      resolve({ code, signal });
    });
  });
}

const sourceStatusBefore = await repositoryStatus(sourceRepoDir);
const temporaryDir = await mkdtemp(join(tmpdir(), 'tbd-web-package-'));
let child = null;
try {
  await packArchive(temporaryDir);
  const archives = (await readdir(temporaryDir)).filter((name) => name.endsWith('.tgz'));
  invariant(archives.length === 1, `Expected one package archive, found ${archives.length}`);
  const archive = join(temporaryDir, archives[0]);
  await execFileAsync('tar', ['-xzf', archive, '-C', temporaryDir]);

  const extracted = join(temporaryDir, 'package');
  // Exercise the tarball's files while reusing this checkout's frozen-lockfile
  // dependency tree. This avoids resolving fresh ranges during a packaging check.
  await symlink(join(packageDir, 'node_modules'), join(extracted, 'node_modules'), 'junction');
  const bootstrap = join(extracted, 'dist', 'bin-bootstrap.cjs');
  const pagePath = join(extracted, 'dist', 'web', 'index.html');
  const manifest = JSON.parse(await readFile(join(extracted, 'package.json'), 'utf8'));
  invariant(typeof manifest.version === 'string', 'Packed package is missing its version');
  await access(bootstrap);
  await access(join(extracted, 'dist', 'tbd'));
  const page = await readFile(pagePath, 'utf8');
  invariant(page.includes('new EventSource'), 'Packed page is missing the browser client');
  invariant(!page.includes('__TBD_WEB_'), 'Packed page still contains stitch markers');
  invariant(!/<script[^>]+src=/iu.test(page), 'Packed page has an external script');

  // Never exercise a stateful CLI command in the source checkout. In v0.6.0 the web
  // proof migrated that checkout from f06 to f07, so the later prepack build saw a
  // dirty tree and embedded a development version in the published release.
  const isolatedRepo = join(temporaryDir, 'repository');
  await mkdir(isolatedRepo);
  await execFileAsync('git', ['init', '--quiet'], { cwd: isolatedRepo });
  await execFileAsync('git', ['config', 'user.name', 'tbd package QA'], { cwd: isolatedRepo });
  await execFileAsync('git', ['config', 'user.email', 'tbd-package-qa@example.invalid'], {
    cwd: isolatedRepo,
  });
  await execFileAsync('git', ['config', 'commit.gpgSign', 'false'], { cwd: isolatedRepo });
  await execFileAsync('git', ['commit', '--allow-empty', '--message', 'Initialize package QA'], {
    cwd: isolatedRepo,
  });
  const cliEnvironment = { ...process.env, NO_COLOR: '1' };
  await execFileAsync(process.execPath, [bootstrap, 'init', '--prefix', 'qa'], {
    cwd: isolatedRepo,
    env: cliEnvironment,
  });
  await execFileAsync(process.execPath, [bootstrap, 'create', 'Package QA seed'], {
    cwd: isolatedRepo,
    env: cliEnvironment,
  });

  const { stdout: versionOutput } = await execFileAsync(
    process.execPath,
    [bootstrap, '--version'],
    {
      cwd: isolatedRepo,
      env: cliEnvironment,
    },
  );
  const packedVersion = versionOutput.trim();
  invariant(packedVersion.length > 0, 'Packed CLI returned an empty version');
  if (process.env.TBD_VERSION_OVERRIDE !== undefined) {
    invariant(
      manifest.version === process.env.TBD_VERSION_OVERRIDE,
      `Package version ${manifest.version} does not match release override ${process.env.TBD_VERSION_OVERRIDE}`,
    );
    invariant(
      packedVersion === process.env.TBD_VERSION_OVERRIDE,
      `Packed CLI reports ${packedVersion}, expected ${process.env.TBD_VERSION_OVERRIDE}`,
    );
  }

  const port = await availablePort();
  child = spawn(process.execPath, [bootstrap, '--json', 'web', '--port', String(port)], {
    cwd: isolatedRepo,
    env: cliEnvironment,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const descriptor = await waitForDescriptor(child);
  invariant(descriptor.url === `http://127.0.0.1:${port}`, 'Packed descriptor URL is wrong');
  const response = await fetch(descriptor.url);
  invariant(response.ok, `Packed page returned HTTP ${response.status}`);
  invariant((await response.text()) === page, 'Packed server did not serve its packed page');
  const board = await fetch(`${descriptor.url}/api/board`);
  invariant(board.ok, `Packed board returned HTTP ${board.status}`);

  const exited = waitForExit(child);
  const handledSignal = process.platform !== 'win32';
  child.kill(handledSignal ? 'SIGTERM' : 'SIGKILL');
  const outcome = await exited;
  if (handledSignal) {
    invariant(outcome.code === 0 && outcome.signal === null, 'Packed server did not stop cleanly');
  }
  child = null;
  const sourceStatusAfter = await repositoryStatus(sourceRepoDir);
  invariant(
    sourceStatusAfter === sourceStatusBefore,
    `Packed web proof changed the source checkout:\n${sourceStatusAfter}`,
  );
  console.log(
    `Packed tbd web proof passed (${archives[0]}, version ${packedVersion}, ${page.length} byte page)`,
  );
} finally {
  if (child !== null && child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
  }
  await rm(temporaryDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
