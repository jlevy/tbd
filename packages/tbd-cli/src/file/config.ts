/**
 * Config file operations.
 *
 * Config is stored at .tbd/config.yml and contains project-level settings.
 *
 * See: tbd-design-v3.md §2.2.2 Config File
 */

import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import type { Config } from '../lib/types.js';
import { ConfigSchema } from '../lib/schemas.js';
import { atomicWriteFile } from './storage.js';

/**
 * Path to config file relative to project root.
 */
export const CONFIG_FILE_PATH = '.tbd/config.yml';

/**
 * Create default config for a new project.
 */
function createDefaultConfig(version: string): Config {
  return ConfigSchema.parse({
    tbd_version: version,
    sync: {
      branch: 'tbd-sync',
      remote: 'origin',
    },
    display: {
      id_prefix: 'bd',
    },
    settings: {
      auto_sync: false,
      index_enabled: true,
    },
  });
}

/**
 * Initialize a new config file with default settings.
 * Creates .tbd directory if it doesn't exist.
 */
export async function initConfig(baseDir: string, version: string): Promise<Config> {
  const tbdDir = join(baseDir, '.tbd');
  await mkdir(tbdDir, { recursive: true });

  const config = createDefaultConfig(version);
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

  await atomicWriteFile(configPath, yaml);
}
