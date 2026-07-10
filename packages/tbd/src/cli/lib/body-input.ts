/**
 * Shared resolver for free-text body inputs (reasons, descriptions, notes).
 *
 * Agents frequently need to pass shell-sensitive text (containing `$`,
 * backticks, or quotes). Rather than fight shell escaping, every body flag
 * accepts the text inline, from a file via a companion `*-file` flag, or from
 * stdin using the `-` convention on either flag. Phase 1 agent CLI ergonomics;
 * see docs/project/specs/active/plan-2026-06-13-agent-cli-ergonomics.md.
 */

import { readFile } from 'node:fs/promises';

import { CLIError } from './errors.js';

/** Tracks single-use of stdin across multiple body inputs in one command. */
export interface BodyInputState {
  stdinUsedBy?: string;
}

export interface BodyInputSpec {
  /** Inline flag name for messages, e.g. `--reason`. */
  name: string;
  /** Value from the inline flag; the `-` sentinel means stdin. */
  value?: string;
  /** Companion `*-file` flag name for messages, e.g. `--reason-file`. */
  fileName?: string;
  /** Path from the `*-file` flag; the `-` sentinel means stdin. */
  file?: string;
}

async function readStdin(flagName: string): Promise<string> {
  // Agents always pipe; a human typing `--reason -` interactively would
  // otherwise stare at a silent hang.
  if (process.stdin.isTTY) {
    process.stderr.write(`Reading ${flagName} from stdin — press Ctrl+D to finish.\n`);
  }
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

/**
 * Resolve one body input to its final string, or `undefined` when unset.
 *
 * - inline text is returned as-is
 * - a `*-file <path>` flag reads the file
 * - `-` on either flag reads stdin (at most one stdin reader per command)
 * - supplying both inline text and a file is an error
 *
 * `state` is required so every command with more than one body input must share
 * one state object across its resolves — that sharing is what detects two `-`
 * sentinels competing for the same stdin.
 */
export async function resolveBodyInput(
  spec: BodyInputSpec,
  state: BodyInputState,
): Promise<string | undefined> {
  const hasValue = spec.value !== undefined;
  const hasFile = spec.file !== undefined;

  if (hasValue && hasFile) {
    throw new CLIError(
      `Use either ${spec.name} or ${spec.fileName ?? `${spec.name}-file`}, not both.`,
    );
  }

  if (spec.value === '-' || spec.file === '-') {
    if (state.stdinUsedBy && state.stdinUsedBy !== spec.name) {
      throw new CLIError(
        `Cannot read both ${state.stdinUsedBy} and ${spec.name} from stdin ('-').`,
      );
    }
    state.stdinUsedBy = spec.name;
    return readStdin(spec.name);
  }

  if (hasFile) {
    try {
      return await readFile(spec.file!, 'utf-8');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new CLIError(`Failed to read ${spec.fileName ?? spec.name}: ${spec.file}: ${message}`);
    }
  }

  return spec.value;
}
