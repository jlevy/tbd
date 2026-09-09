import { createHash } from 'node:crypto';
import { access, chmod, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { asInternalCommentId } from '../src/lib/ids.js';
import {
  createNativeCommentQuarantineArtifact,
  publishNativeCommentQuarantineArtifact,
  serializeNativeCommentQuarantineManifest,
} from '../src/file/native-comment-quarantine.js';
import { TEST_ULIDS } from './test-helpers.js';

const COMMENT_ID = asInternalCommentId(`cm-${TEST_ULIDS.ULID_1}`);
const REVISION_A = 'a'.repeat(40);
const REVISION_B = 'b'.repeat(40);

function digest(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

describe('native comment quarantine', () => {
  let dataSyncDir: string;

  beforeEach(async () => {
    dataSyncDir = await mkdtemp(join(tmpdir(), 'tbd-native-comment-quarantine-'));
  });

  afterEach(async () => {
    await rm(dataSyncDir, { recursive: true, force: true });
  });

  it('preserves raw invalid bytes and stable provenance without ambient paths or time', async () => {
    const bytes = Buffer.from([0xff, 0x00, 0x61, 0x0a]);
    const artifact = createNativeCommentQuarantineArtifact({
      reason: 'invalid-record',
      source: { kind: 'git-ref', revision: REVISION_A },
      sourcePath: `comments/00/${COMMENT_ID}.md`,
      sourceMode: '100644',
      sourceObjectId: 'c'.repeat(40),
      commentId: COMMENT_ID,
      canonicalSha256: 'd'.repeat(64),
      candidateBytes: bytes,
      problemCodes: ['invalid-utf8', 'invalid-record', 'invalid-utf8'],
    });

    const result = await publishNativeCommentQuarantineArtifact(dataSyncDir, artifact);
    const manifest = await readFile(result.manifestPath, 'utf8');

    expect(result.rawPath).toBe(
      join(dataSyncDir, 'attic', 'comment-conflicts', COMMENT_ID, `${digest(bytes)}.md`),
    );
    await expect(readFile(result.rawPath!)).resolves.toEqual(bytes);
    expect(manifest).toBe(serializeNativeCommentQuarantineManifest(artifact));
    expect(manifest).toContain(`revision: ${REVISION_A}`);
    expect(manifest).toContain('problems:\n  - invalid-record\n  - invalid-utf8\n');
    expect(manifest).not.toContain(dataSyncDir);
    expect(manifest).not.toMatch(/timestamp|created_at|observed_at/);
  });

  it('is idempotent and shares raw bytes across distinct provenance manifests', async () => {
    const bytes = Buffer.from('candidate bytes\n');
    const first = createNativeCommentQuarantineArtifact({
      reason: 'same-id-divergence',
      source: { kind: 'git-ref', revision: REVISION_A },
      sourcePath: `comments/00/${COMMENT_ID}.md`,
      commentId: COMMENT_ID,
      candidateBytes: bytes,
    });
    const second = createNativeCommentQuarantineArtifact({
      reason: 'same-id-divergence',
      source: { kind: 'git-ref', revision: REVISION_B },
      sourcePath: `comments/00/${COMMENT_ID}.md`,
      commentId: COMMENT_ID,
      candidateBytes: bytes,
    });

    const created = await publishNativeCommentQuarantineArtifact(dataSyncDir, first);
    await expect(publishNativeCommentQuarantineArtifact(dataSyncDir, first)).resolves.toMatchObject(
      {
        rawStatus: 'existing',
        manifestStatus: 'existing',
        rawPath: created.rawPath,
        manifestPath: created.manifestPath,
      },
    );
    const anotherObservation = await publishNativeCommentQuarantineArtifact(dataSyncDir, second);

    expect(anotherObservation.rawPath).toBe(created.rawPath);
    expect(anotherObservation.rawStatus).toBe('existing');
    expect(anotherObservation.manifestPath).not.toBe(created.manifestPath);
  });

  it('records a deletion deterministically without inventing candidate bytes', async () => {
    const artifact = createNativeCommentQuarantineArtifact({
      reason: 'deleted',
      source: { kind: 'git-index', stage: 0, head: REVISION_A },
      sourcePath: `comments/00/${COMMENT_ID}.md`,
      commentId: COMMENT_ID,
      canonicalSha256: 'd'.repeat(64),
    });

    const result = await publishNativeCommentQuarantineArtifact(dataSyncDir, artifact);

    expect(result.rawPath).toBeUndefined();
    expect(result.rawStatus).toBeUndefined();
    expect(await readFile(result.manifestPath, 'utf8')).toContain('reason: deleted');
  });

  it('publishes raw evidence before its manifest and completes on retry', async () => {
    const bytes = Buffer.from('recoverable candidate\n');
    const artifact = createNativeCommentQuarantineArtifact({
      reason: 'modified',
      source: { kind: 'filesystem', label: 'worktree' },
      sourcePath: `comments/00/${COMMENT_ID}.md`,
      commentId: COMMENT_ID,
      candidateBytes: bytes,
    });
    const rawPath = join(
      dataSyncDir,
      'attic',
      'comment-conflicts',
      COMMENT_ID,
      `${digest(bytes)}.md`,
    );

    await expect(
      publishNativeCommentQuarantineArtifact(dataSyncDir, artifact, {
        onPhase: (phase, paths) => {
          if (phase === 'after-link' && paths.finalPath === rawPath) {
            throw new Error('injected after raw link');
          }
        },
      }),
    ).rejects.toThrow('injected after raw link');
    await expect(readFile(rawPath)).resolves.toEqual(bytes);
    await expect(access(join(dirname(rawPath), 'observations'))).rejects.toMatchObject({
      code: 'ENOENT',
    });

    await expect(
      publishNativeCommentQuarantineArtifact(dataSyncDir, artifact),
    ).resolves.toMatchObject({ rawStatus: 'existing', manifestStatus: 'created' });
  });

  it('never replaces an occupied content-addressed raw or manifest path', async () => {
    const artifact = createNativeCommentQuarantineArtifact({
      reason: 'invalid-record',
      source: { kind: 'filesystem', label: 'worktree' },
      sourcePath: `comments/00/${COMMENT_ID}.md`,
      commentId: COMMENT_ID,
      candidateBytes: Buffer.from('candidate\n'),
    });
    const first = await publishNativeCommentQuarantineArtifact(dataSyncDir, artifact);
    await writeFile(first.rawPath!, 'occupied by different bytes');

    await expect(publishNativeCommentQuarantineArtifact(dataSyncDir, artifact)).rejects.toThrow(
      /quarantine path collision|Cannot verify occupied/,
    );
    await expect(readFile(first.rawPath!, 'utf8')).resolves.toBe('occupied by different bytes');

    await writeFile(first.rawPath!, artifact.candidateBytes!);
    await mkdir(dirname(first.manifestPath), { recursive: true });
    await writeFile(first.manifestPath, 'occupied manifest');
    await expect(publishNativeCommentQuarantineArtifact(dataSyncDir, artifact)).rejects.toThrow(
      /quarantine path collision|Cannot verify occupied/,
    );
    await expect(readFile(first.manifestPath, 'utf8')).resolves.toBe('occupied manifest');
  });

  it.skipIf(process.platform === 'win32')(
    'rejects an executable occupied evidence path even when its bytes match',
    async () => {
      const artifact = createNativeCommentQuarantineArtifact({
        reason: 'invalid-record',
        source: { kind: 'filesystem', label: 'worktree' },
        sourcePath: `comments/00/${COMMENT_ID}.md`,
        commentId: COMMENT_ID,
        candidateBytes: Buffer.from('candidate\n'),
      });
      const first = await publishNativeCommentQuarantineArtifact(dataSyncDir, artifact);
      await chmod(first.rawPath!, 0o755);

      await expect(publishNativeCommentQuarantineArtifact(dataSyncDir, artifact)).rejects.toThrow(
        /Cannot verify occupied/,
      );

      await chmod(first.rawPath!, 0o644);
      await chmod(first.manifestPath, 0o755);
      await expect(publishNativeCommentQuarantineArtifact(dataSyncDir, artifact)).rejects.toThrow(
        /Cannot verify occupied/,
      );
    },
  );

  it('validates a mutated artifact before touching quarantine storage', async () => {
    const artifact = createNativeCommentQuarantineArtifact({
      reason: 'invalid-record',
      source: { kind: 'filesystem', label: 'worktree' },
      sourcePath: `comments/00/${COMMENT_ID}.md`,
      commentId: COMMENT_ID,
      candidateBytes: Buffer.from('candidate\n'),
    });
    (artifact as { candidateSha256?: string }).candidateSha256 = '../escape';

    await expect(publishNativeCommentQuarantineArtifact(dataSyncDir, artifact)).rejects.toThrow(
      /digest does not match/,
    );
    await expect(access(join(dataSyncDir, 'attic'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects symbolic or absolute provenance before touching storage', () => {
    expect(() =>
      createNativeCommentQuarantineArtifact({
        reason: 'deleted',
        source: { kind: 'git-ref', revision: 'HEAD' },
        sourcePath: `comments/00/${COMMENT_ID}.md`,
        commentId: COMMENT_ID,
      }),
    ).toThrow(/not resolved/);
    expect(() =>
      createNativeCommentQuarantineArtifact({
        reason: 'deleted',
        source: { kind: 'filesystem', label: 'worktree' },
        sourcePath: '/absolute/comment.md',
        commentId: COMMENT_ID,
      }),
    ).toThrow(/source path/);
    expect(() =>
      createNativeCommentQuarantineArtifact({
        reason: 'deleted',
        source: { kind: 'git-ref', revision: REVISION_A },
        sourcePath: `comments/00/${COMMENT_ID}.md`,
        sourceObjectId: 'c'.repeat(41),
        commentId: COMMENT_ID,
      }),
    ).toThrow(/object ID/);
  });
});
