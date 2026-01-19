/**
 * Config file operations.
 *
 * Config is stored at .tbd/config.yml and contains project-level settings.
 *
 * See: tbd-design.md §2.2.2 Config File
 */

import { readFile, mkdir, access } from 'node:fs/promises';
import { join, dirname, parse as parsePath } from 'node:path';
import { writeFile } from 'atomically';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import type { Config } from '../lib/types.js';
import { ConfigSchema } from '../lib/schemas.js';
import { CONFIG_FILE, SYNC_BRANCH } from '../lib/paths.js';

/**
 * Path to config file relative to project root.
 * Re-exported from paths.ts for backwards compatibility.
 */
export const CONFIG_FILE_PATH = CONFIG_FILE;

/**
 * Create default config for a new project.
 * @param prefix - Required: the project prefix for display IDs (e.g., "proj", "myapp")
 */
function createDefaultConfig(version: string, prefix: string): Config {
  return ConfigSchema.parse({
    tbd_version: version,
    sync: {
      branch: SYNC_BRANCH,
      remote: 'origin',
    },
    display: {
      id_prefix: prefix,
    },
    settings: {
      auto_sync: false,
    },
  });
}

/**
 * Initialize a new config file with default settings.
 * Creates .tbd directory if it doesn't exist.
 * @param prefix - Required: the project prefix for display IDs (e.g., "proj", "myapp")
 */
export async function initConfig(
  baseDir: string,
  version: string,
  prefix: string,
): Promise<Config> {
  const tbdDir = join(baseDir, '.tbd');
  await mkdir(tbdDir, { recursive: true });

  const config = createDefaultConfig(version, prefix);
  await writeConfig(baseDir, config);

  return config;
}

/**
 * Read config from file.
 * @throws If config file doesn't exist or is invalid.
 */
export async function readConfig(baseDir: string): Promise<Config> {
  const configPath = join(baseDir, CONFIG_FILE_PATH);
  const content = await readFile(configPath, 'utf-8');
  const data: unknown = parseYaml(content);
  return ConfigSchema.parse(data);
}

/**
 * Write config to file.
 */
export async function writeConfig(baseDir: string, config: Config): Promise<void> {
  const configPath = join(baseDir, CONFIG_FILE_PATH);

  const yaml = stringifyYaml(config, {
    sortMapEntries: true,
    lineWidth: 0,
  });

  await writeFile(configPath, yaml);
}

/**
 * Check if tbd is initialized in the given directory (immediate check only).
 * Returns true if .tbd/ directory exists directly in baseDir.
 */
async function hasTbdDir(dir: string): Promise<boolean> {
  const tbdDir = join(dir, '.tbd');
  try {
    await access(tbdDir);
    return true;
  } catch {
    return false;
  }
}

/**
 * Find the tbd repository root by walking up the directory tree.
 * Similar to how git finds .git/ directories.
 *
 * @param startDir - Directory to start searching from
 * @returns The tbd root directory path, or null if not found
 */
export async function findTbdRoot(startDir: string): Promise<string | null> {
  let currentDir = startDir;
  const { root } = parsePath(startDir);

  while (currentDir !== root) {
    if (await hasTbdDir(currentDir)) {
      return currentDir;
    }
    currentDir = dirname(currentDir);
  }

  // Check root directory as well
  if (await hasTbdDir(root)) {
    return root;
  }

  return null;
}

/**
 * Check if tbd is initialized in the given directory or any parent directory.
 * Walks up the directory tree looking for .tbd/.
 */
export async function isInitialized(baseDir: string): Promise<boolean> {
  const root = await findTbdRoot(baseDir);
  return root !== null;
}
