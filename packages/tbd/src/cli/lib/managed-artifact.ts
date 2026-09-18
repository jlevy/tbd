import { readFile } from 'node:fs/promises';

export type ManagedArtifactState = 'current' | 'stale' | 'missing' | 'user-owned' | 'too-new';

export interface ManagedArtifactInspection {
  state: ManagedArtifactState;
  format?: string;
}

export interface InspectManagedArtifactOptions {
  path: string;
  expectedContent: string;
  ownershipMarker: string;
  supportedFormat: string;
  selectManagedContent?: (content: string) => string;
}

/**
 * Return the numeric portion of an integration format stamp. Stamps written
 * through tbd 0.9.0 are two digits (f01..f08, the repository format of the day);
 * later stamps are three digits (f100 and up). Numeric order works across both:
 * `f100` is 100 against 0.9.0's ceiling of 8, so 0.9.0 refuses the surface
 * through the comparison it already ships, with no change to 0.9.0.
 */
export function integrationFormatNumber(format: string): number {
  return Number.parseInt(format.replace(/^f/, ''), 10);
}

/**
 * Read the first `format=fN...` stamp from generated integration content. This
 * regex and the numeric comparison above are what every released tbd uses, so a
 * new stamp must parse here as a number above the older release's ceiling.
 */
export function parseManagedIntegrationFormat(content: string): string | null {
  const match = /format=f(\d+)/.exec(content);
  return match?.[1] ? `f${match[1]}` : null;
}

/**
 * Inspect a tbd-owned text artifact without changing it.
 *
 * Setup dry runs and doctor diagnostics share this comparison so they cannot
 * disagree about whether the generated file is current, stale, or unsafe to
 * replace.
 */
export async function inspectManagedArtifact(
  options: InspectManagedArtifactOptions,
): Promise<ManagedArtifactInspection> {
  let existing: string;
  try {
    existing = await readFile(options.path, 'utf-8');
  } catch (error) {
    if (isErrorWithCode(error, 'ENOENT')) {
      return { state: 'missing' };
    }
    throw error;
  }

  if (!existing.includes(options.ownershipMarker)) {
    return { state: 'user-owned' };
  }

  const managedContent = options.selectManagedContent?.(existing) ?? existing;
  const format = parseManagedIntegrationFormat(managedContent) ?? 'f01';
  if (integrationFormatNumber(format) > integrationFormatNumber(options.supportedFormat)) {
    return { state: 'too-new', format };
  }

  return {
    state: sameManagedContent(managedContent, options.expectedContent) ? 'current' : 'stale',
    format,
  };
}

/**
 * Compare managed content ignoring line endings. Every generator emits LF, while a
 * Windows checkout holds CRLF, so a raw comparison calls each managed surface stale on
 * that platform; setup then writes an LF block into a CRLF file, which leaves the file
 * modified with an empty diff and stale again after the next write.
 */
function sameManagedContent(actual: string, expected: string): boolean {
  return actual === expected || toLf(actual) === toLf(expected);
}

function toLf(text: string): string {
  return text.replace(/\r\n/gu, '\n');
}

/** Extract one marker-delimited managed block, including both marker lines. */
export function extractManagedBlock(
  content: string,
  beginMarker: string,
  endMarker: string,
): string {
  const start = content.indexOf(beginMarker);
  if (start < 0) {
    return '';
  }
  const endStart = content.indexOf(endMarker, start);
  if (endStart < 0) {
    return '';
  }
  return content.slice(start, endStart + endMarker.length).trimEnd() + '\n';
}

function isErrorWithCode(error: unknown, code: string): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string' &&
    error.code === code
  );
}
