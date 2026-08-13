/** Cross-repository guard for binding an external item to one bead source. */

import type { TrackerAdapter } from './types.js';

const BEAD_ATTACHMENT_PREFIX = 'tbd://bead/';

/** Return the durable tbd claims already attached to an external item. */
export async function externalBeadClaims(
  adapter: TrackerAdapter,
  externalId: string,
): Promise<string[]> {
  return (await adapter.listAttachmentUrls(externalId)).filter((url) =>
    url.startsWith(BEAD_ATTACHMENT_PREFIX),
  );
}

/** Refuse a second writer unless the user deliberately overrides the guard. */
export async function assertExternalUnclaimed(
  adapter: TrackerAdapter,
  externalId: string,
  displayRef: string,
  force = false,
): Promise<void> {
  if (force) {
    return;
  }
  const claims = await externalBeadClaims(adapter, externalId);
  if (claims.length > 0) {
    throw new Error(
      `${displayRef} is already linked by another tbd repository (${claims.join(', ')}). ` +
        'Two repositories double-writing one item would cause sync ping-pong; use --force only after verifying the previous link is stale.',
    );
  }
}
