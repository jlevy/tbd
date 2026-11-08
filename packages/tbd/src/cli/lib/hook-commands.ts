/**
 * Equivalent spellings of tbd's generated hook commands.
 *
 * A project may wire tbd's own hook scripts with a command that locates the project
 * root differently from the one setup generates: `bash "$CLAUDE_PROJECT_DIR"/.claude/...`
 * instead of `bash .claude/...`, or `bash "$(git rev-parse --show-toplevel)/.codex/..."`.
 * Such a command runs the same script with the same arguments, so setup treats it as
 * the generated command (it neither rewrites it nor adds a duplicate beside it), and
 * doctor treats it as current.
 *
 * Only these exact spellings count. A command that adds anything else (another
 * command, a redirection, different arguments) stays the user's own command.
 */

/** Project-root expression that works in any Git checkout. */
export const GIT_TOPLEVEL_ROOT = '$(git rev-parse --show-toplevel)';

/** Root expressions accepted for Claude Code hooks, which export CLAUDE_PROJECT_DIR. */
export const CLAUDE_HOOK_ROOTS = [
  '$CLAUDE_PROJECT_DIR',
  '${CLAUDE_PROJECT_DIR}',
  GIT_TOPLEVEL_ROOT,
];

/** Root expressions accepted for Codex hooks. */
export const CODEX_HOOK_ROOTS = [GIT_TOPLEVEL_ROOT];

/**
 * Every accepted spelling of `bash <scriptRel> <args>`: the relative path (bare or
 * with `./`), and each root expression in front of it, quoted either around the root
 * alone or around the whole path. Unquoted roots are not accepted because they break
 * on a path with spaces.
 */
export function scriptInvocationSpellings(
  scriptRel: string,
  args: readonly string[],
  roots: readonly string[],
): ReadonlySet<string> {
  const suffix = args.length > 0 ? ` ${args.join(' ')}` : '';
  const paths = [
    scriptRel,
    `./${scriptRel}`,
    ...roots.flatMap((root) => [`"${root}"/${scriptRel}`, `"${root}/${scriptRel}"`]),
  ];
  return new Set(paths.map((path) => `bash ${path}${suffix}`));
}

/** The setup and doctor note for customized spellings a hooks file keeps. */
export function customizedHookNote(count: number): string {
  return `${count} customized hook command${count === 1 ? '' : 's'} kept`;
}
