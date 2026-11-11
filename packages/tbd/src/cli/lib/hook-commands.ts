/**
 * Equivalent spellings of tbd's generated hook commands.
 *
 * A project may wire tbd's own hook scripts with a command that locates the project
 * root differently from the one setup generates, for example
 * `bash "${CLAUDE_PROJECT_DIR}"/.claude/...` or
 * `bash "$(git rev-parse --show-toplevel)/.codex/..."`. Setup recognizes these spellings
 * as tbd's wiring, so it never leaves one beside a generated duplicate, and sorts them
 * by where they find the script:
 *
 * - **Anchored** spellings resolve the script from a root the agent fixes to the
 *   project for every hook, wherever the session's working directory is. Claude Code's
 *   `$CLAUDE_PROJECT_DIR` is such an anchor. Setup keeps an anchored spelling as the
 *   project's own wiring, and doctor treats it as current.
 * - **Unanchored** spellings resolve the script against the working directory (`bash
 *   .codex/...`, `bash ./.codex/...`) or the working directory's Git checkout
 *   (`$(git rev-parse --show-toplevel)`). When a hook runs inside a nested checkout,
 *   such as a third-party clone under `attic/`, they run that checkout's script, or fail
 *   when it has none. Setup replaces them with the generated command, and doctor reports
 *   them as stale.
 *
 * Only these exact spellings count. A command that adds anything else (another
 * command, a redirection, different arguments) stays the user's own command.
 */

/** Project-root expression for the working directory's Git checkout: unanchored. */
export const GIT_TOPLEVEL_ROOT = '$(git rev-parse --show-toplevel)';

/**
 * Anchors for Claude Code hooks: Claude Code sets CLAUDE_PROJECT_DIR to the project
 * directory for every hook, whatever directory the session has changed to.
 */
export const CLAUDE_HOOK_ANCHORS = ['$CLAUDE_PROJECT_DIR', '${CLAUDE_PROJECT_DIR}'];

/**
 * Anchors for Codex hooks: none. Codex runs a hook in the session's working directory
 * and exports no project-root variable, so the only cwd-independent Codex command is
 * tbd's generated boundary wrapper, which setup recognizes exactly.
 */
export const CODEX_HOOK_ANCHORS: readonly string[] = [];

/** The recognized spellings of one generated command, by how they find the script. */
export interface ScriptInvocationSpellings {
  /** Anchored spellings: setup keeps them in place of the generated command. */
  anchored: ReadonlySet<string>;
  /** Spellings relative to the working directory or its Git checkout: setup replaces them. */
  unanchored: ReadonlySet<string>;
}

/**
 * The recognized spellings of `bash <scriptRel> <args>`. Anchored: each anchor in front
 * of the path, quoted either around the anchor alone or around the whole path.
 * Unanchored: the relative path (bare or with `./`) and the Git top-level root in the
 * same two quotings. Unquoted roots are not recognized because they break on a path
 * with spaces.
 */
export function scriptInvocationSpellings(
  scriptRel: string,
  args: readonly string[],
  anchors: readonly string[],
): ScriptInvocationSpellings {
  const suffix = args.length > 0 ? ` ${args.join(' ')}` : '';
  const rooted = (root: string) => [`"${root}"/${scriptRel}`, `"${root}/${scriptRel}"`];
  const commands = (paths: string[]) => new Set(paths.map((path) => `bash ${path}${suffix}`));
  return {
    anchored: commands(anchors.flatMap(rooted)),
    unanchored: commands([scriptRel, `./${scriptRel}`, ...rooted(GIT_TOPLEVEL_ROOT)]),
  };
}

/** The setup and doctor note for customized spellings a hooks file keeps. */
export function customizedHookNote(count: number): string {
  return `${count} customized hook command${count === 1 ? '' : 's'} kept`;
}
