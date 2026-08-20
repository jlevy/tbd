/**
 * Locate npm's global bin directory and decide whether it is reachable on PATH.
 *
 * tbd tells agents to install and upgrade the CLI with `npm install -g get-tbd@latest`
 * (the skill, `tbd doctor` suggestions, and the incompatible-format error all say so).
 * That instruction silently does nothing useful when npm's global bin directory is not
 * on PATH: npm exits 0, prints an install summary, and the `tbd` binary still does not
 * resolve. Agent containers hit this whenever Node was unpacked into a directory whose
 * own `bin/` is not on PATH, which is common when a session bootstrap installs a pinned
 * Node itself rather than using a version manager.
 *
 * Scoped to npm on purpose: `npm install -g` is the instruction tbd actually gives.
 * pnpm and Bun have their own global bin resolution and their own setup commands.
 */

import { execFile } from 'node:child_process';
import { posix, win32, type PlatformPath } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** `npm prefix -g` is a local metadata read; it should never take this long. */
const NPM_PREFIX_TIMEOUT_MS = 5000;

/**
 * Path semantics for the target platform, not the running one.
 *
 * The bare `node:path` exports follow the host, so `delimiter` would be `;` and
 * `resolve` would apply drive letters when these functions run on Windows. Selecting
 * the implementation from the caller's platform keeps them testable from any host,
 * which is what the cross-platform CI matrix exercises.
 *
 * The independence from the host holds for absolute inputs. Both `resolve`
 * implementations fall back to `process.cwd()` for a relative segment, so a relative
 * PATH entry still mixes in the host's own convention. npm prefixes and PATH entries
 * are absolute in practice, so this does not arise.
 */
function pathFor(platform: NodeJS.Platform): PlatformPath {
  return platform === 'win32' ? win32 : posix;
}

/**
 * The command that reads npm's global prefix on the target platform.
 *
 * On Windows npm is `npm.cmd`, and a `.cmd` is a script for the command interpreter
 * rather than an executable image, so `CreateProcess` cannot launch it and
 * `child_process.execFile` fails with ENOENT. Route it through `cmd.exe` there, matching
 * `openWebBrowser` in `cli/web/server.ts`. Preferred over `shell: true`, which Node
 * deprecates for argument-taking spawns (DEP0190).
 *
 * Exported so the Windows branch is assertable from any host; without that, the branch
 * is only reachable on a Windows runner and no test spawns npm.
 */
export function npmPrefixCommand(platform: NodeJS.Platform): { file: string; args: string[] } {
  return platform === 'win32'
    ? { file: 'cmd.exe', args: ['/d', '/s', '/c', 'npm', 'prefix', '-g'] }
    : { file: 'npm', args: ['prefix', '-g'] };
}

/**
 * Resolve npm's global bin directory from its global prefix.
 *
 * On Windows the global bin is the prefix itself; elsewhere it is `<prefix>/bin`.
 */
export function npmGlobalBinDir(prefix: string, platform: NodeJS.Platform): string {
  const path = pathFor(platform);
  return platform === 'win32' ? path.resolve(prefix) : path.resolve(prefix, 'bin');
}

/**
 * True when `dir` is one of the entries in a PATH-style value.
 *
 * Entries are compared as resolved paths so `/usr/local/bin/` and `/usr/local/bin`
 * match, and case-insensitively on Windows.
 *
 * Windows PATH entries containing spaces are often quoted (`"C:\Program Files\nodejs"`).
 * `win32.resolve` keeps the quotes, so an unstripped entry would never match and the
 * caller would advise adding a directory that is already there. A false positive is
 * worse than a miss here, because the advice would be wrong.
 */
export function isDirOnPath(
  dir: string,
  pathValue: string | undefined,
  platform: NodeJS.Platform,
): boolean {
  if (!pathValue) {
    return false;
  }

  const path = pathFor(platform);
  const unquote = (value: string): string =>
    platform === 'win32' && value.length >= 2 && value.startsWith('"') && value.endsWith('"')
      ? value.slice(1, -1)
      : value;
  const normalize = (value: string): string => {
    const resolved = path.resolve(unquote(value));
    return platform === 'win32' ? resolved.toLowerCase() : resolved;
  };

  const target = normalize(dir);
  return pathValue
    .split(path.delimiter)
    .filter((entry) => entry.length > 0)
    .some((entry) => normalize(entry) === target);
}

/**
 * Read npm's global prefix, or null when npm is unavailable or does not answer.
 *
 * A missing npm is not an error here: it means there is no global install location to
 * misconfigure. Callers report that as "nothing to check", not as a failure.
 */
export async function readNpmGlobalPrefix(
  platform: NodeJS.Platform = process.platform,
): Promise<string | null> {
  const { file, args } = npmPrefixCommand(platform);
  try {
    const { stdout } = await execFileAsync(file, args, {
      timeout: NPM_PREFIX_TIMEOUT_MS,
    });
    const prefix = stdout.trim();
    return prefix.length > 0 ? prefix : null;
  } catch {
    return null;
  }
}
