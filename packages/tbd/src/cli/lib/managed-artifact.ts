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

/** Return the numeric portion of an `fNN` integration format. */
export function integrationFormatNumber(format: string): number {
  return Number.parseInt(format.replace(/^f/, ''), 10);
}

/** Read the first `format=fNN` marker from generated integration content. */
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
    state: managedContent === options.expectedContent ? 'current' : 'stale',
    format,
  };
}

/** Extract one marker-delimited managed block, including both marker lines. */
export function extractManagedBlock(
  content: string,
  beginMarker: string,
  endMarker: string,
): string {
  const start = content.indexOf(beginMarker);
  if (start < 0) return '';
  const endStart = content.indexOf(endMarker, start);
  if (endStart < 0) return '';
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
