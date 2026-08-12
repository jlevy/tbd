/** Persistent seqlock-style epoch for non-blocking data-sync snapshot readers. */

import { randomUUID } from 'node:crypto';
import { open } from 'node:fs/promises';

import { writeFile } from 'atomically';

export type DataSyncEpochPhase = 'active' | 'quiescent';

export interface DataSyncEpoch {
  phase: DataSyncEpochPhase;
  id: string;
  /** Exact persisted value used for before/after equality. */
  token: string;
}

const DATA_SYNC_EPOCH =
  /^(active|quiescent):([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/u;
const MAX_DATA_SYNC_EPOCH_BYTES = 128;

function encodeDataSyncEpoch(phase: DataSyncEpochPhase, id: string): string {
  return `${phase}:${id}`;
}

/** Read and strictly validate the persistent writer epoch. */
export async function readDataSyncEpoch(path: string): Promise<DataSyncEpoch> {
  const handle = await open(path, 'r');
  let token: string;
  try {
    // Read one byte beyond the protocol budget so a corrupt machine-local file is
    // rejected without allocating its full size on every reconciliation tick.
    const buffer = Buffer.allocUnsafe(MAX_DATA_SYNC_EPOCH_BYTES + 1);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead > MAX_DATA_SYNC_EPOCH_BYTES) {
      throw new Error(
        `Data-sync writer epoch at ${path} exceeds ${MAX_DATA_SYNC_EPOCH_BYTES} bytes`,
      );
    }
    token = buffer.subarray(0, bytesRead).toString('utf8').trim();
  } finally {
    await handle.close();
  }
  const match = DATA_SYNC_EPOCH.exec(token);
  if (match === null) {
    throw new Error(`Invalid data-sync writer epoch at ${path}`);
  }
  return {
    phase: match[1] as DataSyncEpochPhase,
    id: match[2]!,
    token,
  };
}

/** Mark a newly acquired writer critical section active before it mutates shared data. */
export async function beginDataSyncWrite(path: string): Promise<string> {
  const id = randomUUID();
  await writeFile(path, `${encodeDataSyncEpoch('active', id)}\n`);
  return id;
}

/** Mark the writer's resulting on-disk state quiescent before its mutex is released. */
export async function finishDataSyncWrite(path: string, id: string): Promise<void> {
  await writeFile(path, `${encodeDataSyncEpoch('quiescent', id)}\n`);
}
