/**
 * Unit tests for resolveSpecArg: the write-side `--spec` resolver that gives
 * `create`/`update` the same exact/suffix/filename matching `list --spec`
 * already has (agent CLI ergonomics round 2, tbd-1der).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { resolveSpecArg } from '../src/lib/project-paths.js';

describe('resolveSpecArg', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'tbd-spec-arg-'));
    await mkdir(join(root, 'docs/project/specs/active'), { recursive: true });
    await mkdir(join(root, 'docs/project/specs/done'), { recursive: true });
    await writeFile(join(root, 'docs/project/specs/active/plan-2026-01-01-widget.md'), '# w');
    await writeFile(join(root, 'docs/project/specs/done/plan-2026-02-02-gadget.md'), '# g');
    await writeFile(join(root, 'docs/project/specs/done/plan-dupe.md'), '# d1');
    await writeFile(join(root, 'docs/project/specs/active/plan-dupe.md'), '# d2');
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('resolves a literal repo-relative path unchanged', async () => {
    const resolved = await resolveSpecArg(
      'docs/project/specs/active/plan-2026-01-01-widget.md',
      root,
      root,
    );
    expect(resolved.relativePath).toBe('docs/project/specs/active/plan-2026-01-01-widget.md');
  });

  it('resolves a unique basename to its full path', async () => {
    const resolved = await resolveSpecArg('plan-2026-02-02-gadget.md', root, root);
    expect(resolved.relativePath).toBe('docs/project/specs/done/plan-2026-02-02-gadget.md');
  });

  it('resolves a unique path suffix', async () => {
    const resolved = await resolveSpecArg('active/plan-2026-01-01-widget.md', root, root);
    expect(resolved.relativePath).toBe('docs/project/specs/active/plan-2026-01-01-widget.md');
  });

  it('rejects an ambiguous basename, naming every candidate', async () => {
    await expect(resolveSpecArg('plan-dupe.md', root, root)).rejects.toMatchObject({
      code: 'AMBIGUOUS',
      message: expect.stringContaining('docs/project/specs/active/plan-dupe.md'),
    });
    await expect(resolveSpecArg('plan-dupe.md', root, root)).rejects.toMatchObject({
      message: expect.stringContaining('docs/project/specs/done/plan-dupe.md'),
    });
  });

  it('a suffix disambiguates a duplicated basename', async () => {
    const resolved = await resolveSpecArg('done/plan-dupe.md', root, root);
    expect(resolved.relativePath).toBe('docs/project/specs/done/plan-dupe.md');
  });

  it('keeps the original not-found error when nothing matches', async () => {
    await expect(resolveSpecArg('plan-no-such-spec.md', root, root)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect.assertions(1);
  });

  it('still resolves relative paths from a subdirectory (literal wins)', async () => {
    const resolved = await resolveSpecArg(
      '../active/plan-2026-01-01-widget.md',
      root,
      join(root, 'docs/project/specs/done'),
    );
    expect(resolved.relativePath).toBe('docs/project/specs/active/plan-2026-01-01-widget.md');
  });
});
