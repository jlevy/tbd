/**
 * Origin labels: the `tbd` marker and the `repo/<name>` group label.
 *
 * These are what make a shared tracker legible — `label is not tbd` gives a human their
 * board back, and the `repo` group answers "which repository is this from" when several
 * report into one surface.
 */

import { describe, it, expect } from 'vitest';

import {
  ORIGIN_LABEL,
  REPO_LABEL_GROUP,
  sanitizeRepoLabel,
  resolveRepoLabelName,
  originLabelsFor,
  isForeignRepoLabel,
} from '../src/integrations/core/origin-labels.js';

const ON = { originLabel: true, repoLabel: 'auto' as const };

describe('repo label naming', () => {
  it('derives the repository name from the git origin', () => {
    expect(
      resolveRepoLabelName({ setting: 'auto', originRemoteUrl: 'git@github.com:jlevy/tbd.git' }),
    ).toBe('tbd');
    expect(
      resolveRepoLabelName({ setting: 'auto', originRemoteUrl: 'https://github.com/jlevy/tbd' }),
    ).toBe('tbd');
  });

  it('uses the repo name alone, not owner/name', () => {
    // The owner is the same for every repository in most workspaces, so including it
    // would add noise to every label without distinguishing anything.
    const name = resolveRepoLabelName({
      setting: 'auto',
      originRemoteUrl: 'git@github.com:some-org/service-api.git',
    });
    expect(name).toBe('service-api');
    expect(name).not.toContain('some-org');
  });

  it('falls back to the display prefix when there is no remote', () => {
    // A local-only checkout still gets a stable name rather than silently losing the
    // marker that makes its items filterable.
    expect(resolveRepoLabelName({ setting: 'auto', idPrefix: 'tbd' })).toBe('tbd');
  });

  it('honours an explicit override', () => {
    expect(
      resolveRepoLabelName({ setting: 'Custom Name', originRemoteUrl: 'git@github.com:o/r.git' }),
    ).toBe('custom-name');
  });

  it('returns nothing when the repo label is disabled', () => {
    expect(
      resolveRepoLabelName({ setting: false, originRemoteUrl: 'git@github.com:o/r.git' }),
    ).toBeUndefined();
  });

  it('sanitizes to characters a label and a filter term tolerate', () => {
    expect(sanitizeRepoLabel('My Repo!')).toBe('my-repo');
    expect(sanitizeRepoLabel('  ---  ')).toBe('repo');
  });
});

describe('origin labels', () => {
  it('marks every mirrored item with tbd and its repo group', () => {
    const labels = originLabelsFor({
      settings: ON,
      originRemoteUrl: 'git@github.com:jlevy/tbd.git',
    });
    expect(labels).toEqual([ORIGIN_LABEL, `${REPO_LABEL_GROUP}/tbd`]);
  });

  it('drops the whole scheme when origin labelling is off', () => {
    expect(originLabelsFor({ settings: { originLabel: false, repoLabel: 'auto' } })).toEqual([]);
  });

  it('keeps the plain marker when only the repo label is disabled', () => {
    const labels = originLabelsFor({
      settings: { originLabel: true, repoLabel: false },
      originRemoteUrl: 'git@github.com:jlevy/tbd.git',
    });
    expect(labels).toEqual([ORIGIN_LABEL]);
  });

  it('still marks an item when the remote is unreadable', () => {
    // Losing the marker is worse than an imprecise name: an unmarked item cannot be
    // filtered out of a human's board at all.
    expect(originLabelsFor({ settings: ON, idPrefix: 'proj' })).toEqual([
      ORIGIN_LABEL,
      `${REPO_LABEL_GROUP}/proj`,
    ]);
  });
});

describe('foreign repo labels', () => {
  it('recognizes a sibling repository’s label in a shared scope', () => {
    // A candidate carrying another repo's group label is that repo's business; importing
    // it here would duplicate the bead on both sides.
    expect(isForeignRepoLabel(`${REPO_LABEL_GROUP}/other-repo`, 'tbd')).toBe(true);
    expect(isForeignRepoLabel(`${REPO_LABEL_GROUP}/tbd`, 'tbd')).toBe(false);
  });

  it('ignores labels outside the repo group', () => {
    expect(isForeignRepoLabel(ORIGIN_LABEL, 'tbd')).toBe(false);
    expect(isForeignRepoLabel('bug', 'tbd')).toBe(false);
  });
});
