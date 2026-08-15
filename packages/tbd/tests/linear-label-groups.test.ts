/**
 * Tests for the qualified-name mapping between tbd's `group/leaf` label names and
 * Linear's group model, where a grouped label's `name` is only the leaf.
 */

import { describe, it, expect } from 'vitest';
import {
  splitQualifiedName,
  joinQualifiedName,
  qualifyLabel,
  indexLabels,
  qualifiedIssueLabels,
} from '../src/integrations/linear/label-groups.js';

describe('linear label groups', () => {
  describe('splitQualifiedName', () => {
    it('splits a grouped name into group and leaf', () => {
      expect(splitQualifiedName('repo/tbd')).toEqual({ group: 'repo', leaf: 'tbd' });
    });

    it('leaves an ungrouped name alone', () => {
      expect(splitQualifiedName('tbd')).toEqual({ leaf: 'tbd' });
    });

    it('splits only on the first separator, since Linear groups are one level deep', () => {
      expect(splitQualifiedName('repo/a/b')).toEqual({ group: 'repo', leaf: 'a/b' });
    });

    it('treats a leading or trailing separator as part of the name, not a split', () => {
      // Otherwise `/x` would ask for a group with an empty name, which Linear rejects,
      // and the whole label would be dropped rather than created as written.
      expect(splitQualifiedName('/x')).toEqual({ leaf: '/x' });
      expect(splitQualifiedName('x/')).toEqual({ leaf: 'x/' });
    });

    it('round-trips through join', () => {
      const { group, leaf } = splitQualifiedName('repo/tbd');
      expect(joinQualifiedName(group, leaf)).toBe('repo/tbd');
      expect(joinQualifiedName(undefined, 'tbd')).toBe('tbd');
    });
  });

  describe('qualifyLabel', () => {
    it('qualifies a grouped label with its parent name', () => {
      const label = qualifyLabel({
        id: 'l1',
        name: 'tbd',
        parent: { id: 'g1', name: 'repo' },
      });
      expect(label.qualifiedName).toBe('repo/tbd');
      expect(label.leafName).toBe('tbd');
      expect(label.groupName).toBe('repo');
      expect(label.isGroup).toBe(false);
    });

    it('leaves a root label unqualified', () => {
      expect(qualifyLabel({ id: 'l2', name: 'tbd' }).qualifiedName).toBe('tbd');
    });

    it('marks a group as one', () => {
      expect(qualifyLabel({ id: 'g1', name: 'repo', isGroup: true }).isGroup).toBe(true);
    });
  });

  describe('indexLabels', () => {
    it('distinguishes a root label from a grouped leaf of the same name', () => {
      // The exact collision this repo hits: the origin marker `tbd` and the repo label
      // for a repository also called `tbd`. Keyed by bare name one silently wins.
      const index = indexLabels([
        { id: 'root-tbd', name: 'tbd' },
        { id: 'group-repo', name: 'repo', isGroup: true },
        { id: 'child-tbd', name: 'tbd', parent: { id: 'group-repo', name: 'repo' } },
      ]);

      expect(index.get('tbd')?.id).toBe('root-tbd');
      expect(index.get('repo/tbd')?.id).toBe('child-tbd');
      expect(index.size).toBe(3);
    });

    it('includes groups so a child can be created under one', () => {
      const index = indexLabels([{ id: 'g1', name: 'repo', isGroup: true }]);
      expect(index.get('repo')).toMatchObject({ id: 'g1', isGroup: true });
    });

    it('keeps the first entry when a workspace has genuinely ambiguous duplicates', () => {
      const index = indexLabels([
        { id: 'first', name: 'tbd' },
        { id: 'second', name: 'tbd' },
      ]);
      expect(index.get('tbd')?.id).toBe('first');
    });
  });

  describe('qualifiedIssueLabels', () => {
    it('reports a grouped label under the name tbd asks for', () => {
      // Without this the engine diffs its required `repo/tbd` against a read-back `tbd`,
      // never matches, and re-asserts the label on every sync forever.
      expect(
        qualifiedIssueLabels([
          { id: 'l1', name: 'tbd' },
          { id: 'l2', name: 'tbd', parent: { id: 'g1', name: 'repo' } },
        ]),
      ).toEqual(['tbd', 'repo/tbd']);
    });

    it('drops group labels, which are containers rather than applied labels', () => {
      expect(
        qualifiedIssueLabels([
          { id: 'g1', name: 'repo', isGroup: true },
          { id: 'l1', name: 'tbd', parent: { id: 'g1', name: 'repo' } },
        ]),
      ).toEqual(['repo/tbd']);
    });
  });
});
