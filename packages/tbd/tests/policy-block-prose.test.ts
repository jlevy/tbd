import { describe, expect, it } from 'vitest';

import { getCodexTbdSection } from '../src/cli/commands/setup.js';
import {
  hasCurrentPolicyBlockProse,
  refreshPolicyBlockProse,
} from '../src/lib/policy-block-prose.js';
import {
  POLICY_BLOCK_PROSE,
  PolicyBlockError,
  parsePolicyBlock,
  renderPolicyBlock,
  withPolicyBlock,
} from '../src/lib/policy-grants.js';

const INITIAL_PROSE =
  'The user granted these policies explicitly for this project. A user instruction in the\n' +
  'current conversation overrides them. For what each policy means, run\n' +
  '`tbd guidelines agent-policy-grants`; to change them, run `tbd policy`.';
const DEFAULT_GUIDANCE = POLICY_BLOCK_PROSE.slice(POLICY_BLOCK_PROSE.indexOf('Only the copy'));
const CURRENT_CONTENT = withPolicyBlock(
  getCodexTbdSection(),
  renderPolicyBlock(
    [
      { name: 'subagents', value: 'granted' },
      { name: 'future-policy', value: 'keep exactly' },
    ],
    '2025-01-02',
  ),
).replace(
  '- `future-policy`: keep exactly',
  'User note before grants.\n\n-   `future-policy`:   keep exactly\n\nUser note afterward.',
);

describe('policy block prose', () => {
  it.each([
    INITIAL_PROSE,
    `${INITIAL_PROSE}\n${DEFAULT_GUIDANCE}`,
    POLICY_BLOCK_PROSE.split('\nOnly the copy')[0]!,
  ])('refreshes prior guidance without re-rendering grants or notes: %s', (legacy) => {
    for (const eol of ['\n', '\r\n']) {
      const current = CURRENT_CONTENT.replace(/\n/gu, eol);
      const before = CURRENT_CONTENT.replace(POLICY_BLOCK_PROSE, legacy).replace(/\n/gu, eol);
      const beforeParse = parsePolicyBlock(before);
      expect(beforeParse.status).toBe('ok');
      const after = refreshPolicyBlockProse(before);
      expect(after).toBe(current);
      const afterParse = parsePolicyBlock(after);
      expect(afterParse).toMatchObject({
        status: 'ok',
        grants: beforeParse.status === 'ok' ? beforeParse.grants : [],
        recorded: '2025-01-02',
      });
      expect(refreshPolicyBlockProse(after)).toBe(after);
    }
  });

  it('accepts rewrapped guidance and restamps only legacy integration formats', () => {
    const rewrapped = CURRENT_CONTENT.replace(
      POLICY_BLOCK_PROSE,
      POLICY_BLOCK_PROSE.replace(/\s+/gu, ' '),
    );
    expect(hasCurrentPolicyBlockProse(rewrapped)).toBe(true);
    expect(refreshPolicyBlockProse(rewrapped)).toBe(rewrapped);
    const oldStamp = CURRENT_CONTENT.replace('format=f100', 'format=f08').replace(
      POLICY_BLOCK_PROSE,
      INITIAL_PROSE,
    );
    expect(refreshPolicyBlockProse(oldStamp)).toBe(CURRENT_CONTENT);
    expect(refreshPolicyBlockProse(CURRENT_CONTENT.replace('format=f100', 'format=f08'))).toBe(
      CURRENT_CONTENT,
    );
  });

  it('adds missing guidance while preserving handwritten notes, grants, and date', () => {
    const before = CURRENT_CONTENT.replace(POLICY_BLOCK_PROSE, 'A handwritten note.');
    const after = refreshPolicyBlockProse(before);
    expect(hasCurrentPolicyBlockProse(after)).toBe(true);
    expect(after).toContain('A handwritten note.');
    expect(after).toContain('-   `future-policy`:   keep exactly');
    expect(after).toContain('Recorded 2025-01-02.');
    expect(refreshPolicyBlockProse(after)).toBe(after);
  });

  it('refuses unfamiliar edits rather than deleting user prose', () => {
    const before = CURRENT_CONTENT.replace(
      POLICY_BLOCK_PROSE,
      'The user granted these policies explicitly for this project. My custom guidance.',
    );
    expect(() => refreshPolicyBlockProse(before)).toThrow(/unrecognized edits/u);
  });

  it.each([
    getCodexTbdSection(),
    CURRENT_CONTENT.replace('POLICY GRANTS v=1', 'POLICY GRANTS v=2'),
    CURRENT_CONTENT.replace(
      '- `subagents`: granted',
      '- `subagents`: granted\n- `subagents`: not-granted',
    ),
    CURRENT_CONTENT.replace('format=f100', 'format=f999'),
  ])('refuses unreadable or newer blocks', (content) => {
    expect(() => refreshPolicyBlockProse(content)).toThrow(PolicyBlockError);
  });
});
