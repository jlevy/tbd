/** Shared grammar for configured display prefixes and prefixed issue IDs. */

/**
 * Prefixes are 1-20 lowercase characters, start with a letter, may contain
 * alphanumerics, dots, or underscores, and end with an alphanumeric.
 * Hyphens remain the unambiguous prefix/short-id separator.
 */
export const DISPLAY_PREFIX_PATTERN_SOURCE = '[a-z](?:[a-z0-9._]{0,18}[a-z0-9])?';
/** Imported short IDs may contain separators but cannot end in the display separator. */
export const EXTERNAL_SHORT_ID_PATTERN_SOURCE = '[0-9a-z._-]*[0-9a-z._]';

const DISPLAY_PREFIX_PATTERN = new RegExp(`^${DISPLAY_PREFIX_PATTERN_SOURCE}$`);
const PREFIXED_ID_PATTERN = new RegExp(`^(${DISPLAY_PREFIX_PATTERN_SOURCE})-(.+)$`);

export function isValidDisplayPrefix(value: string): boolean {
  return DISPLAY_PREFIX_PATTERN.test(value);
}

/** Split a syntactically prefixed id after normalizing case. */
export function splitPrefixedDisplayId(
  value: string,
): { prefix: string; shortId: string } | undefined {
  const match = PREFIXED_ID_PATTERN.exec(value.toLowerCase());
  if (!match?.[1] || !match[2]) {
    return undefined;
  }
  return { prefix: match[1], shortId: match[2] };
}
