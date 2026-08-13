import { describe, expect, it } from 'vitest';

import { parseLinearLiveQaArgs } from '../scripts/linear-live-qa-options.js';

describe('parseLinearLiveQaArgs', () => {
  it('requires project scope so the release gate cannot skip isolation proof', () => {
    expect(() => parseLinearLiveQaArgs(['--team', 'TBD'])).toThrow(
      'Usage: validate-linear-integration-live.ts --team <key> --project <name-or-slug>',
    );
  });

  it('returns normalized team and project identifiers', () => {
    expect(parseLinearLiveQaArgs(['--', '--team', ' TBD ', '--project', ' tbd '])).toEqual({
      team: 'TBD',
      project: 'tbd',
    });
  });
});
