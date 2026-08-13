/**
 * The managed region tbd maintains inside an external item's description.
 *
 * External trackers have no place for most bead fields (Linear has no custom
 * fields at all), so a generated block carries them in prose. Only the region
 * between the markers is ever rewritten, so anything a human writes around it
 * survives the next mirror.
 */

import type { Issue } from '../../lib/types.js';

/** Stable, Markdown-inert boundaries for tbd-owned description content. */
export const MANAGED_BLOCK_MARKERS = {
  begin: '⟦tbd⟧',
  end: '⟦/tbd⟧',
} as const;

/** Read-only compatibility pair for descriptions written before the plain-text format. */
const LEGACY_MANAGED_BLOCK_MARKERS = {
  begin: '<!-- tbd:begin -->',
  end: '<!-- tbd:end -->',
} as const;

const READABLE_MANAGED_BLOCK_MARKERS = [
  MANAGED_BLOCK_MARKERS,
  LEGACY_MANAGED_BLOCK_MARKERS,
] as const;

interface LocatedManagedBlock {
  kind: 'valid';
  begin: number;
  end: number;
  endMarkerLength: number;
}

type ManagedBlockLocation = LocatedManagedBlock | { kind: 'none' } | { kind: 'malformed' };

export interface MirrorLinks {
  /** Permalink to the linked plan spec, if the bead has one. */
  specUrl?: string;
  /** Permalink to the bead file on the sync branch. */
  repoUrl?: string;
  /** Pull request URLs associated with the bead. */
  prUrls?: string[];
}

export interface BeadCounts {
  children: number;
  ready: number;
}

/**
 * Render the generated summary for a bead.
 *
 * Deliberately compact: this sits at the top of a human's issue description, and
 * a wall of generated text there is worse than no text.
 */
export function renderManagedBlock(
  issue: Issue,
  links: MirrorLinks = {},
  counts?: BeadCounts,
  displayId?: string,
): string {
  const id = displayId ?? issue.id;
  const lines: string[] = [
    MANAGED_BLOCK_MARKERS.begin,
    `\`${id}\` · ${issue.kind} · ${issue.status} · P${issue.priority}`,
  ];

  if (links.specUrl) {
    const name = issue.spec_path?.split('/').pop() ?? 'spec';
    lines.push(`Spec: [${name}](${links.specUrl})`);
  }
  if (links.prUrls && links.prUrls.length > 0) {
    lines.push(`PRs: ${links.prUrls.map((url) => `[${prLabel(url)}](${url})`).join(' · ')}`);
  }
  if (counts) {
    lines.push(`Children: ${counts.children} (${counts.ready} ready)`);
  }
  if (links.repoUrl) {
    lines.push(`Bead: [${id}](${links.repoUrl}) · \`tbd show ${id}\``);
  } else {
    lines.push(`Bead: \`tbd show ${id}\``);
  }

  lines.push(
    '',
    'Mirrored by tbd. Edits inside this block are overwritten.',
    MANAGED_BLOCK_MARKERS.end,
  );
  return lines.join('\n');
}

/** Render `#205` from a pull request URL, falling back to the raw URL. */
function prLabel(url: string): string {
  const match = /\/pull\/(\d+)/.exec(url);
  return match?.[1] ? `#${match[1]}` : url;
}

export type SpliceResult = { result: string } | { error: 'markers-malformed' };

/**
 * Remove the managed region from a description, returning only the human
 * prose. Used when comparing a tracker description against a bead body: tbd's
 * own splice must never register as a remote edit.
 *
 * Malformed markers return the text unchanged — the comparison then sees a
 * difference, which surfaces the problem rather than hiding it.
 */
export function stripManagedBlock(description: string | null | undefined): string {
  const body = description ?? '';
  const location = locateManagedBlock(body);
  if (location.kind !== 'valid') {
    return body;
  }
  const before = body.slice(0, location.begin).trimEnd();
  const after = body.slice(location.end + location.endMarkerLength).trimStart();
  if (!before) {
    return after;
  }
  if (!after) {
    return before;
  }
  return `${before}\n\n${after}`;
}

/**
 * Replace the managed region of a description.
 *
 * Appends the block when no markers are present. Refuses when markers are
 * malformed (end before begin, or either marker repeated): guessing where the
 * region boundary was intended risks destroying a human's text, so the caller
 * reports and skips instead.
 */
export function spliceManagedBlock(description: string | null, block: string): SpliceResult {
  const body = description ?? '';
  const location = locateManagedBlock(body);

  if (location.kind === 'none') {
    const separator = body.trim().length > 0 ? '\n\n' : '';
    return { result: `${body.trimEnd()}${separator}${block}` };
  }

  if (location.kind === 'malformed') {
    return { error: 'markers-malformed' };
  }

  const before = body.slice(0, location.begin);
  const after = body.slice(location.end + location.endMarkerLength);
  return { result: `${before}${block}${after}` };
}

/** Locate one supported marker pair without guessing across malformed formats. */
function locateManagedBlock(body: string): ManagedBlockLocation {
  let found: LocatedManagedBlock | undefined;

  for (const markers of READABLE_MANAGED_BLOCK_MARKERS) {
    const beginCount = countOccurrences(body, markers.begin);
    const endCount = countOccurrences(body, markers.end);
    if (beginCount === 0 && endCount === 0) {
      continue;
    }
    if (found || beginCount !== 1 || endCount !== 1) {
      return { kind: 'malformed' };
    }

    const begin = body.indexOf(markers.begin);
    const end = body.indexOf(markers.end);
    if (end < begin) {
      return { kind: 'malformed' };
    }
    found = { kind: 'valid', begin, end, endMarkerLength: markers.end.length };
  }

  return found ?? { kind: 'none' };
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}
