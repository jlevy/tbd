import { describe, it, expect } from 'vitest';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { resolveBodyInput } from '../src/cli/lib/body-input.js';

describe('resolveBodyInput', () => {
  it('returns inline text unchanged', async () => {
    expect(await resolveBodyInput({ name: '--reason', value: 'done' }, {})).toBe('done');
  });

  it('returns undefined when nothing is set', async () => {
    expect(await resolveBodyInput({ name: '--reason' }, {})).toBeUndefined();
  });

  it('preserves shell-sensitive characters in inline text', async () => {
    const raw = 'cost is $5 `whoami` "ok" \'q\'';
    expect(await resolveBodyInput({ name: '--reason', value: raw }, {})).toBe(raw);
  });

  it('reads the body from a file verbatim', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'body-input-'));
    try {
      const path = join(dir, 'reason.txt');
      const body = 'multi\nline $VAR `tick` "quote"';
      await writeFile(path, body, 'utf-8');
      expect(
        await resolveBodyInput({ name: '--reason', fileName: '--reason-file', file: path }, {}),
      ).toBe(body);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('errors when both inline text and a file are given', async () => {
    await expect(
      resolveBodyInput({ name: '--reason', value: 'x', fileName: '--reason-file', file: 'y' }, {}),
    ).rejects.toThrow(/either --reason or --reason-file/);
  });

  it('errors when the file cannot be read', async () => {
    await expect(
      resolveBodyInput(
        { name: '--reason', fileName: '--reason-file', file: '/no/such/file-xyz' },
        {},
      ),
    ).rejects.toThrow(/Failed to read --reason-file/);
  });

  it('errors when two fields both request stdin', async () => {
    // Pre-seed state as if --description already claimed stdin; this throws
    // before any read, so no real stdin is touched.
    const state = { stdinUsedBy: '--description' };
    await expect(resolveBodyInput({ name: '--notes', value: '-' }, state)).rejects.toThrow(
      /Cannot read both --description and --notes from stdin/,
    );
  });
});
