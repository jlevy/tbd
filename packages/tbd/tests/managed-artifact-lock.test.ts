import { mkdir, mkdtemp, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { withAgentsMdLock } from '../src/cli/lib/managed-artifact.js';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

it.each(['.tbd', '.tbd/locks'])(
  'refuses a linked %s lock parent without external writes',
  async (linked) => {
    const root = await mkdtemp(join(tmpdir(), 'tbd-lock-boundary-'));
    roots.push(root);
    const project = join(root, 'project');
    const outside = join(root, 'outside');
    await mkdir(project);
    await mkdir(outside);
    if (linked === '.tbd/locks') {
      await mkdir(join(project, '.tbd'));
    }
    await symlink(
      outside,
      join(project, linked),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    let called = false;
    await expect(
      withAgentsMdLock(project, () => {
        called = true;
        return Promise.resolve();
      }),
    ).rejects.toThrow('symbolic link');
    expect(called).toBe(false);
    expect(await readdir(outside)).toEqual([]);
  },
);
