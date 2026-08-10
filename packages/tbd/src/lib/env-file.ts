/**
 * Reading `.env` files for integration credentials.
 *
 * Parsing uses Node's built-in `util.parseEnv`, which is dotenv-compatible
 * (quotes, comments, `export` prefixes, multiline values) and needs no
 * dependency.
 *
 * IMPORTANT: nothing here writes to `process.env`. Spawned git processes inherit
 * the environment and git runs user hooks, so a credential placed in the process
 * environment would be handed to every hook in the repository. Values travel
 * only through explicit return values.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseEnv } from 'node:util';

/** Name of the environment file read from the repository root. */
export const ENV_FILE_NAME = '.env';

/**
 * Parse `.env` content into a map.
 *
 * Exported for testing; prefer `readEnvFile` for normal use.
 */
export function parseEnvContent(content: string): Map<string, string> {
  const parsed = parseEnv(content) as Record<string, unknown>;
  const result = new Map<string, string>();
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === 'string') {
      result.set(key, value);
    }
  }
  return result;
}

/**
 * Read and parse `<repoRoot>/.env`.
 *
 * Returns an empty map when the file does not exist: an absent `.env` is a
 * normal state, not an error. Unreadable for any other reason is a real problem
 * and propagates.
 */
export async function readEnvFile(repoRoot: string): Promise<Map<string, string>> {
  let content: string;
  try {
    content = await readFile(join(repoRoot, ENV_FILE_NAME), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return new Map();
    }
    throw error;
  }
  return parseEnvContent(content);
}
