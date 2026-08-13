import { describe, expect, it } from 'vitest';

import {
  buildRestorationAtticEntry,
  decodeAtticTextValue,
  parseAtticFilename,
  resolveAtticIssueId,
} from '../src/cli/commands/attic.js';
import type { AtticEntry } from '../src/lib/types.js';
import type { IdMapping } from '../src/file/id-mapping.js';

describe('attic filename parsing', () => {
  it('accepts real base32 ULIDs containing letters beyond hexadecimal f', () => {
    expect(
      parseAtticFilename('is-01kzxakjxggsrkx1hty70ms845_2026-08-13T10-37-51.362Z_title.yml'),
    ).toEqual({
      entityId: 'is-01kzxakjxggsrkx1hty70ms845',
      timestamp: '2026-08-13T10:37:51.362Z',
      field: 'title',
    });
  });

  it('resolves a configured display ID through the shared mapping', () => {
    const mapping: IdMapping = {
      shortToUlid: new Map([['eqgx', '01kzxakjxggsrkx1hty70ms845']]),
      ulidToShort: new Map([['01kzxakjxggsrkx1hty70ms845', 'eqgx']]),
    };

    expect(resolveAtticIssueId('qa-eqgx', mapping)).toBe('is-01kzxakjxggsrkx1hty70ms845');
  });

  it('decodes JSON text without breaking legacy plain-text entries', () => {
    expect(decodeAtticTextValue('"A title with \\"quotes\\""')).toBe('A title with "quotes"');
    expect(decodeAtticTextValue('legacy plain text')).toBe('legacy plain text');
    expect(decodeAtticTextValue('null')).toBeNull();
  });

  it('archives the current winner before restoring the previous loser', () => {
    const original: AtticEntry = {
      entity_id: 'is-01kzxakjxggsrkx1hty70ms845',
      timestamp: '2026-08-13T10:37:51.362Z',
      field: 'title',
      lost_value: '"previous title"',
      winner_source: 'remote',
      loser_source: 'local',
      context: {
        local_version: 4,
        remote_version: 0,
        local_updated_at: '2026-08-13T10:37:50.000Z',
        remote_updated_at: '2026-08-13T10:37:51.000Z',
      },
    };

    expect(
      buildRestorationAtticEntry({
        original,
        currentValue: 'current winner',
        currentVersion: 5,
        currentUpdatedAt: '2026-08-13T10:40:00.000Z',
        restoredAt: '2026-08-13T10:41:00.000Z',
      }),
    ).toEqual({
      entity_id: original.entity_id,
      timestamp: '2026-08-13T10:41:00.000Z',
      field: 'title',
      lost_value: '"current winner"',
      winner_source: 'local',
      loser_source: 'remote',
      context: {
        local_version: 5,
        remote_version: 0,
        local_updated_at: '2026-08-13T10:40:00.000Z',
        remote_updated_at: '2026-08-13T10:37:51.000Z',
      },
    });
  });
});
