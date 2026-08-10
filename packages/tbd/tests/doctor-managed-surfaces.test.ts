import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TBD_BIN = join(__dirname, '..', 'dist', 'bin.mjs');

interface DiagnosticResult {
  name: string;
  status: 'ok' | 'warn' | 'error';
  message?: string;
  suggestion?: string;
}

interface DoctorResult {
  integrationChecks: DiagnosticResult[];
}

describe('doctor managed agent surfaces', { timeout: 45_000 }, () => {
  let projectDir: string;
  let fakeHome: string;

  beforeEach(async () => {
    projectDir = await mkdtemp(join(tmpdir(), 'tbd-doctor-surfaces-'));
    fakeHome = join(projectDir, '.home');
    await mkdir(fakeHome);
    run(['git', 'init', '--initial-branch=main']);
    run(['git', 'config', 'user.email', 'test@example.com']);
    run(['git', 'config', 'user.name', 'Test']);
    await writeFile(join(projectDir, 'README.md'), '# Fixture\n');
    run(['git', 'add', 'README.md']);
    run(['git', 'commit', '-m', 'test: initialize fixture']);

    const setup = runTbd(['setup', '--auto', '--prefix=test']);
    expect(setup.status).toBe(0);
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  function run(command: [string, ...string[]]): void {
    const result = spawnSync(command[0], command.slice(1), {
      cwd: projectDir,
      encoding: 'utf-8',
    });
    expect(result.status, result.stderr).toBe(0);
  }

  function runTbd(args: string[]): { stdout: string; stderr: string; status: number } {
    const result = spawnSync('node', [TBD_BIN, ...args], {
      cwd: projectDir,
      encoding: 'utf-8',
      env: {
        ...process.env,
        HOME: fakeHome,
        USERPROFILE: fakeHome,
        FORCE_COLOR: '0',
        NO_COLOR: '1',
      },
    });
    return {
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      status: result.status ?? 1,
    };
  }

  function findingNamed(name: string): {
    result: ReturnType<typeof runTbd>;
    finding: DiagnosticResult;
  } {
    const result = runTbd(['doctor', '--json']);
    const report = JSON.parse(result.stdout) as DoctorResult;
    const finding = report.integrationChecks.find((check) => check.name === name);
    expect(finding).toBeDefined();
    return { result, finding: finding! };
  }

  function portableFinding(): { result: ReturnType<typeof runTbd>; finding: DiagnosticResult } {
    return findingNamed('Portable Agent Skill');
  }

  it('distinguishes current, stale, missing, user-owned, and too-new skills without writes', async () => {
    const skillPath = join(projectDir, '.agents', 'skills', 'tbd', 'SKILL.md');
    const expected = await readFile(skillPath, 'utf-8');

    expect(portableFinding().finding).toMatchObject({ status: 'ok', message: 'current' });

    const stale = expected.replace('Git-native issue tracking', 'STALE issue tracking');
    await writeFile(skillPath, stale);
    const staleFinding = portableFinding().finding;
    expect(staleFinding).toMatchObject({
      status: 'warn',
      message: 'stale managed file',
      suggestion: 'Run: tbd setup --auto --surfaces=portable',
    });
    expect(await readFile(skillPath, 'utf-8')).toBe(stale);

    await rm(skillPath);
    expect(portableFinding().finding).toMatchObject({
      status: 'warn',
      message: 'missing',
      suggestion: 'Run: tbd setup --auto --surfaces=portable',
    });

    await writeFile(skillPath, '---\nname: personal-tbd\n---\nUser-owned instructions.\n');
    expect(portableFinding().finding).toMatchObject({
      status: 'warn',
      message: 'user-owned file (not managed by tbd)',
      suggestion: 'Move the file, then run: tbd setup --auto --surfaces=portable',
    });

    const agentsPath = join(projectDir, 'AGENTS.md');
    await writeFile(
      agentsPath,
      `User note mentioning format=f99.\n\n${await readFile(agentsPath, 'utf-8')}`,
    );
    expect(findingNamed('AGENTS.md').finding).toMatchObject({ status: 'ok', message: 'current' });

    await writeFile(skillPath, expected.replace('format=f06', 'format=f99'));
    const tooNew = portableFinding();
    expect(tooNew.result.status).toBe(1);
    expect(tooNew.finding).toMatchObject({
      status: 'error',
      message: 'managed file uses newer integration format f99 (supported: f06)',
      suggestion: 'Upgrade tbd to manage this file: npm install -g get-tbd@latest',
    });
  });

  it('detects stale generated hook content without changing it', async () => {
    const sessionScript = join(projectDir, '.codex', 'tbd-session.sh');
    expect(findingNamed('Codex hooks').finding).toMatchObject({
      status: 'ok',
      message: 'current',
    });

    await writeFile(sessionScript, '#!/bin/bash\necho stale\n');
    expect(findingNamed('Codex hooks').finding).toMatchObject({
      status: 'warn',
      message: 'stale managed file',
      suggestion: 'Run: tbd setup --auto --surfaces=codex',
    });
    expect(await readFile(sessionScript, 'utf-8')).toBe('#!/bin/bash\necho stale\n');
  });
});
