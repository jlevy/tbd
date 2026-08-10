/**
 * The managed region tbd maintains inside an external item's description.
 *
 * External trackers have no place for most bead fields (Linear has no custom
 * fields at all), so a generated block carries them in prose. Only the region
 * between the markers is ever rewritten, so anything a human writes around it
 * survives the next mirror.
 */

import type { Issue } from '../../lib/types.js';

export const BLOCK_BEGIN = '<!-- tbd:begin -->';
export const BLOCK_END = '<!-- tbd:end -->';

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
    BLOCK_BEGIN,
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

  lines.push('', 'Mirrored by tbd. Edits inside this block are overwritten.', BLOCK_END);
  return lines.join('\n');
}

/** Render `#205` from a pull request URL, falling back to the raw URL. */
function prLabel(url: string): string {
  const match = /\/pull\/(\d+)/.exec(url);
  return match?.[1] ? `#${match[1]}` : url;
}

export type SpliceResult = { result: string } | { error: 'markers-malformed' };

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

  const beginCount = countOccurrences(body, BLOCK_BEGIN);
  const endCount = countOccurrences(body, BLOCK_END);

  if (beginCount === 0 && endCount === 0) {
    const separator = body.trim().length > 0 ? '\n\n' : '';
    return { result: `${body.trimEnd()}${separator}${block}` };
  }

  if (beginCount !== 1 || endCount !== 1) {
    return { error: 'markers-malformed' };
  }

  const begin = body.indexOf(BLOCK_BEGIN);
  const end = body.indexOf(BLOCK_END);
  if (end < begin) {
    return { error: 'markers-malformed' };
  }

  const before = body.slice(0, begin);
  const after = body.slice(end + BLOCK_END.length);
  return { result: `${before}${block}${after}` };
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
