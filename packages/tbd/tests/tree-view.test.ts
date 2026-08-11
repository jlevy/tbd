/**
 * Golden tests for the `--pretty` tree renderer.
 *
 * The depth-3 case is the regression for tbd-5hh1: `renderTreeNode` dropped the
 * ancestor prefix when attaching a child's connector, so every grandchild rendered at
 * depth 1 and deep subtrees read as siblings of their own parents. Depth 2 cannot see
 * the bug (the ancestor prefix is empty there), which is why coverage stops being
 * optional at three levels.
 */

import { describe, expect, it } from 'vitest';

import { buildIssueTree, renderIssueTree } from '../src/cli/lib/tree-view.js';
import type { IssueForTree } from '../src/cli/lib/tree-view.js';
import { createColors } from '../src/cli/lib/output.js';

/** Colors disabled so golden lines are plain text. */
const colors = createColors('never');

function issue(id: string, title: string, parentId?: string): IssueForTree {
  return { id, title, parentId, priority: 2, status: 'open', kind: 'task' };
}

/** Strip the fixed-width id/priority/status columns down to the tree structure. */
function structureOf(lines: string[]): string[] {
  return lines.map((line) => {
    const match = /^((?:[│ ] {3})*(?:├── |└── )?)(\S+)/u.exec(line);
    return match ? `${match[1]}${match[2]}` : line;
  });
}

describe('renderIssueTree', () => {
  it('renders three levels at their true depth (tbd-5hh1)', () => {
    const tree = buildIssueTree([
      issue('aa-root', 'Root epic'),
      issue('aa-kid1', 'First child', 'aa-root'),
      issue('aa-kid2', 'Second child', 'aa-root'),
      issue('aa-gkid1', 'First grandchild', 'aa-kid2'),
      issue('aa-gkid2', 'Second grandchild', 'aa-kid2'),
      issue('aa-ggkid', 'Great-grandchild', 'aa-gkid2'),
    ]);
    const lines = renderIssueTree(tree, colors);

    expect(structureOf(lines)).toEqual([
      'aa-root',
      '├── aa-kid1',
      '└── aa-kid2',
      '    ├── aa-gkid1',
      '    └── aa-gkid2',
      '        └── aa-ggkid',
    ]);
  });

  it('draws continuation bars for non-last branches at depth', () => {
    // Hint-less children sort by id, so 'bb-amid' orders before 'bb-zlast' and the
    // branching child is deliberately the non-last one.
    const tree = buildIssueTree([
      issue('bb-root', 'Root'),
      issue('bb-amid', 'Middle', 'bb-root'),
      issue('bb-deep', 'Deep', 'bb-amid'),
      issue('bb-zlast', 'Last child', 'bb-root'),
    ]);
    const lines = renderIssueTree(tree, colors);

    // bb-amid is not the last child, so its subtree carries the │ bar, not spaces.
    expect(structureOf(lines)).toEqual([
      'bb-root',
      '├── bb-amid',
      '│   └── bb-deep',
      '└── bb-zlast',
    ]);
  });

  it('keeps two-level rendering unchanged', () => {
    const tree = buildIssueTree([
      issue('cc-root', 'Root'),
      issue('cc-one', 'One', 'cc-root'),
      issue('cc-two', 'Two', 'cc-root'),
    ]);
    expect(structureOf(renderIssueTree(tree, colors))).toEqual([
      'cc-root',
      '├── cc-one',
      '└── cc-two',
    ]);
  });
});
