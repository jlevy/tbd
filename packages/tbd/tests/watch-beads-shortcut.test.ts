/** Safety contracts for the unattended worker recipe shipped in the watch shortcut. */

import { spawnSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeAll, describe, expect, it } from 'vitest';

let shortcut = '';
const cleanupPaths: string[] = [];
const TIP = 'b'.repeat(40);
const BASH = process.platform === 'win32' ? 'bash' : '/bin/bash';

beforeAll(async () => {
  shortcut = await readFile(
    new URL('../docs/shortcuts/standard/watch-beads.md', import.meta.url),
    'utf8',
  );
});

afterEach(async () => {
  await Promise.all(cleanupPaths.splice(0).map((path) => rm(path, { recursive: true })));
});

function unattendedScript(): string {
  const fenceStart = shortcut.indexOf('```bash\nset -euo pipefail');
  const fenceEnd = shortcut.indexOf('\n```', fenceStart + 1);
  expect(fenceStart).toBeGreaterThanOrEqual(0);
  expect(fenceEnd).toBeGreaterThan(fenceStart);
  return shortcut.slice(fenceStart + '```bash\n'.length, fenceEnd);
}

async function createHarness(): Promise<{
  cwd: string;
  env: NodeJS.ProcessEnv;
  log: string;
  workerInput: string;
}> {
  const cwd = await mkdtemp(join(tmpdir(), 'tbd-watch-shortcut-'));
  cleanupPaths.push(cwd);
  const binDir = join(cwd, 'bin');
  const log = join(cwd, 'events.log');
  const watchCount = join(cwd, 'watch-count');
  const workerInput = join(cwd, 'worker-input');
  await mkdir(join(cwd, '.tbd'));
  await mkdir(binDir);
  await writeFile(
    join(binDir, 'tbd'),
    `#!/usr/bin/env bash
set -eu
case "\${1:-}" in
  watch)
    count=0
    if [ -f "$HARNESS_WATCH_COUNT" ]; then IFS= read -r count < "$HARNESS_WATCH_COUNT"; fi
    count=$((count + 1))
    printf '%s\n' "$count" > "$HARNESS_WATCH_COUNT"
    printf 'watch %s\n' "$*" >> "$HARNESS_LOG"
    if [ "$count" -eq 1 ]; then
      printf '%s\n' '{"format_version":1,"since":"${'a'.repeat(40)}","tip":"${TIP}","changes":[]}'
      exit 0
    fi
    exit 4
    ;;
  sync)
    if [ "\${2:-}" = "--pull" ]; then printf '%s\n' pull >> "$HARNESS_LOG"; else printf '%s\n' sync >> "$HARNESS_LOG"; fi
    ;;
  ready)
    printf '%s\n' ready >> "$HARNESS_LOG"
    printf '%s\n' '[]'
    ;;
  *) exit 64 ;;
esac
`,
  );
  await writeFile(
    join(binDir, 'claude'),
    `#!/usr/bin/env bash
set -eu
printf '%s\n' worker >> "$HARNESS_LOG"
cat > "$HARNESS_WORKER_INPUT"
if [ "\${HARNESS_WORKER_FAIL:-0}" -eq 1 ]; then exit 9; fi
`,
  );
  await chmod(join(binDir, 'tbd'), 0o755);
  await chmod(join(binDir, 'claude'), 0o755);
  return {
    cwd,
    log,
    workerInput,
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH ?? ''}`,
      HARNESS_LOG: log,
      HARNESS_WATCH_COUNT: watchCount,
      HARNESS_WORKER_INPUT: workerInput,
    },
  };
}

describe('watch-beads unattended recipe', () => {
  it('is valid Bash and persists a pending report before starting the worker', () => {
    const script = unattendedScript();

    const syntax = spawnSync(BASH, ['-n'], { input: script, encoding: 'utf8' });

    expect(syntax.status, syntax.stderr).toBe(0);
    expect(script).toContain('pending_file=');
    expect(script).toContain('watch_once()');
    expect(script).not.toContain('since_args');
    expect(script.indexOf('mv "$report_tmp" "$pending_file"')).toBeLessThan(
      script.indexOf('claude -p'),
    );
  });

  it('pulls and revalidates before work, then checkpoints only after work and sync', () => {
    const pull = shortcut.indexOf('tbd sync --pull');
    const revalidate = shortcut.indexOf('tbd ready --json');
    const worker = shortcut.indexOf('claude -p');
    const finalSync = shortcut.indexOf('if ! tbd sync; then', worker);
    const checkpoint = shortcut.indexOf('>"$checkpoint_tmp"', finalSync);
    const clearPending = shortcut.indexOf('rm -f "$pending_file"', checkpoint);

    expect(pull).toBeGreaterThanOrEqual(0);
    expect(revalidate).toBeGreaterThan(pull);
    expect(worker).toBeGreaterThan(revalidate);
    expect(finalSync).toBeGreaterThan(worker);
    expect(checkpoint).toBeGreaterThan(finalSync);
    expect(clearPending).toBeGreaterThan(checkpoint);
    expect(shortcut).not.toContain('<"$wake_file" || true');
  });

  it('exits on signals and states that --notes replaces rather than appends', () => {
    expect(shortcut).toContain("trap 'exit 129' HUP");
    expect(shortcut).toContain("trap 'exit 130' INT");
    expect(shortcut).toContain("trap 'exit 143' TERM");
    expect(shortcut).toMatch(/--notes`\s+replaces/i);
    expect(shortcut).not.toMatch(/write messages with `tbd update <id> --notes <message>`/i);
  });

  it.skipIf(process.platform === 'win32')(
    'retries a preserved pending report after worker failure before checkpointing',
    async () => {
      const harness = await createHarness();
      const failed = spawnSync(BASH, ['-c', unattendedScript()], {
        cwd: harness.cwd,
        env: { ...harness.env, HARNESS_WORKER_FAIL: '1' },
        encoding: 'utf8',
      });

      expect(failed.status, failed.stderr).toBe(1);
      await expect(
        readFile(join(harness.cwd, '.tbd', 'ready-worker.pending.tmp'), 'utf8'),
      ).resolves.toContain(`"tip":"${TIP}"`);
      await expect(
        readFile(join(harness.cwd, '.tbd', 'ready-worker.checkpoint.tmp'), 'utf8'),
      ).rejects.toThrow();
      expect((await readFile(harness.log, 'utf8')).trim().split('\n')).toEqual([
        'watch watch --ready --json',
        'pull',
        'ready',
        'worker',
      ]);

      const retried = spawnSync(BASH, ['-c', unattendedScript()], {
        cwd: harness.cwd,
        env: harness.env,
        encoding: 'utf8',
      });

      expect(retried.status, retried.stderr).toBe(4);
      await expect(
        readFile(join(harness.cwd, '.tbd', 'ready-worker.checkpoint.tmp'), 'utf8'),
      ).resolves.toBe(`${TIP}\n`);
      await expect(
        readFile(join(harness.cwd, '.tbd', 'ready-worker.pending.tmp'), 'utf8'),
      ).rejects.toThrow();
      expect(await readFile(harness.workerInput, 'utf8')).toContain(
        'CURRENT READY SET (after tbd sync --pull):',
      );
      expect((await readFile(harness.log, 'utf8')).trim().split('\n')).toEqual([
        'watch watch --ready --json',
        'pull',
        'ready',
        'worker',
        'pull',
        'ready',
        'worker',
        'sync',
        `watch watch --ready --json --since ${TIP}`,
      ]);
    },
  );
});
