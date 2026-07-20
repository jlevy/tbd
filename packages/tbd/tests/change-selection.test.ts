import { describe, expect, it } from 'vitest';

import { parseChangeSelection } from '../src/cli/lib/change-selection.js';

describe('parseChangeSelection', () => {
  it('treats an empty --spec value as absent for backward compatibility', () => {
    expect(parseChangeSelection({ spec: '' }, false)).toEqual({ kind: 'all' });
    expect(() => parseChangeSelection({ spec: '' }, true)).toThrow(/selector is required/i);
  });
});
