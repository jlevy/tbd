import type { IssueStatusType } from './types.js';

/**
 * Canonical issue-status symbols shared by every presentation surface.
 *
 * Keep this module presentation-only and browser-safe: both the terminal and
 * the bundled web viewer import it, while each surface owns its own colors.
 */
export const STATUS_ICONS = {
  open: '○',
  in_progress: '◐',
  blocked: '●',
  deferred: '○',
  closed: '✓',
} as const satisfies Record<IssueStatusType, string>;
