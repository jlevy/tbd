# Development Guide

This document covers development setup and workflows for `get-tbd` (the tbd CLI).

## Prerequisites

- Node.js >= 20
- pnpm (will be installed automatically via corepack)

## Setup

```bash
# Enable corepack (includes pnpm)
corepack enable

# Install dependencies
pnpm install

# Install git hooks
pnpm prepare
```

## Development Workflow

### Running the CLI from source

During development, run the CLI directly from TypeScript source (no build needed):

```bash
pnpm tbd --help
pnpm tbd list
pnpm tbd create "My issue" -t bug
```

### Running the built CLI

To test the production build:

```bash
pnpm build
pnpm tbd:bin --help
```

### Testing new shortcuts, guidelines, or templates

**Important**: When adding new documentation files (shortcuts, guidelines, templates) to
`packages/tbd/docs/`, you must test with the **local build**, not the globally installed
`tbd`.

The globally installed `tbd` has its own bundled docs from the published npm package.
Running `tbd setup --auto` with the global installation won’t include your new files.

```bash
# 1. Add your new file to packages/tbd/docs/shortcuts/standard/my-shortcut.md

# 2. Build to bundle the new file into dist/docs/
pnpm build

# 3. Run setup with the LOCAL build (from repo root)
node packages/tbd/dist/bin.mjs setup --auto

# 4. Verify the file was copied to .tbd/docs/
ls .tbd/docs/shortcuts/standard/my-shortcut.md

# 5. Test the shortcut with the local build
node packages/tbd/dist/bin.mjs shortcut my-shortcut
```

**Never manually create files in `.tbd/docs/`**—always add them to `packages/tbd/docs/`
and let `setup --auto` copy them.
This ensures the setup process works correctly for users.

### Testing the packaged installation

To test the CLI exactly as users would install it from npm:

```bash
# Build, pack, and install globally (like npm install -g get-tbd)
pnpm test:install

# Test the installed binary
tbd --help

# Uninstall when done
pnpm test:uninstall
```

This creates an npm tarball and installs from it, validating the full package structure.

### Building

```bash
# Build all packages
pnpm build

# Watch mode for development
pnpm --filter get-tbd dev
```

### Testing

```bash
# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Watch mode
pnpm --filter get-tbd test:watch
```

### Formatting and Linting

```bash
# Format code (auto-fix)
pnpm format

# Check formatting (CI)
pnpm format:check

# Lint with auto-fix
pnpm lint

# Lint check only (CI)
pnpm lint:check

# Type check
pnpm typecheck
```

### Validating Package

```bash
# Validate package.json exports
pnpm publint
```

## Git Hooks

Git hooks are managed by lefthook and run automatically:

- **pre-commit**: Format, lint, and typecheck staged files
- **pre-push**: Build (if needed), run tests, and — when a `package.json` is staged —
  enforce the 14-day package-age rule via `pnpm check:package-age`.

To skip hooks (emergency only):

```bash
git commit --no-verify
git push --no-verify
```

## Dependency Hygiene: the 14-day Package-Age Rule

This repo enforces the **14-day package-age rule** documented in
[`packages/tbd/docs/guidelines/pnpm-monorepo-patterns.md`](../packages/tbd/docs/guidelines/pnpm-monorepo-patterns.md#supply-chain-mitigation):
do not install or upgrade to any package version less than 14 days old.

- `pnpm upgrade:check`, `pnpm upgrade`, and `pnpm upgrade:major` are wired to
  `ncu --cooldown 14`; they will refuse to bump to versions inside the window.
- `pnpm check:package-age` (also wired into `pre-push`) scans every `package.json` in
  the repo, queries the npm registry for each pinned version’s publish time, and exits
  non-zero on any pin under 14 days.
  Add `--warn` to report without failing.
- Exceptions (CVE patches inside the window) must be documented in the commit message or
  PR description with CVE ID, upstream link, and a `Reviewed-by:` line.

The check requires registry access (`https://registry.npmjs.org`); skip it with
`SKIP=package-age git push` only if you’re pushing infrastructure changes that do not
touch dependencies.

## Commit Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.

### Format

```
<type>: <description>

[optional body]

[optional footer(s)]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation for the product or main codebase (not process docs)
- `process`: Documentation or tooling changes to agent or human development processes
- `style`: Code style (formatting, no logic change)
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `test`: Adding or updating tests
- `chore`: Maintenance tasks (deps, config, etc.)

### Examples

```
feat: Add support for custom labels

fix: Handle empty issue list gracefully

docs: Update CLI usage examples

process: Add TDD guidelines for agent workflows

test: Add golden tests for sync command

chore: Update dependencies
```

### Notes

- **No scope by default**: Don’t include a scope like `fix(tbd):` for the main codebase.
  Only use a scope when it provides key disambiguation or clarification (e.g.,
  `fix(parser):` vs `fix(cli):` when the distinction matters).
- Keep the first line under 72 characters
- Use imperative mood ("Add feature" not “Added feature”)

## Creating Releases

Releases are **tag-triggered** and assembled from clean conventional commits — we do
**not** use Changesets (no `.changeset/` files, no “Version Packages” PR). `get-tbd` is
a single published package, so the per-PR changeset ceremony isn’t worth it; release
notes are composed from the commits since the last tag at release time.

`.github/workflows/release.yml` runs on a `v*` tag push: it builds, runs `publint`,
publishes `get-tbd` to npm, and creates a GitHub Release whose body is the matching
`## X.Y.Z` section of `packages/tbd/CHANGELOG.md`.

### Release process

1. From clean `main`, review `git log <last-tag>..HEAD` and choose the version (a `feat`
   → minor, `fix`/`chore` → patch, breaking → major; note for `0.x` a semver minor is
   `0.MINOR.0`).
2. On a `claude/release-vX.Y.Z` branch: bump `version` in `packages/tbd/package.json`
   and prepend a `## X.Y.Z` section to `packages/tbd/CHANGELOG.md` with notes written
   per
   [`release-notes-guidelines`](../packages/tbd/docs/guidelines/release-notes-guidelines.md).
3. `pnpm release:verify` (build and publint) and `pnpm test`; open the release PR; merge
   once CI is green.
4. Tag `vX.Y.Z` on `main` and push it — the Release workflow publishes to npm and
   creates the GitHub Release.

For the full step-by-step (including the version-bump heuristic, supply-chain review,
and verification), see [publishing.md](publishing.md).

## CI and GitHub Actions

**Keep logic out of workflow YAML.** Do not put non-trivial shell — multi-line `awk`,
`sed`, `jq` pipelines, regex parsing, conditional logic — inline in a GitHub Actions
`run:` step. Inline CI shell cannot be tested or debugged in isolation; the only way to
exercise it is to push a tag or branch and wait for the runner, which is slow and
error-prone. A real bug shipped this way: the release workflow’s inline `awk` changelog
extractor silently produced an empty body on every release (`v0.1.30` and `v0.2.0` both
went out with the fallback `Release vX.Y.Z` string) because it exited 0 either way.

Instead, write a clean, unit-tested script and invoke it by reference:

- Put the logic in `packages/tbd/scripts/*.mjs` (or a `src/` module) with a pure,
  exported function. See `scripts/extract-changelog.mjs` and its test
  `tests/extract-changelog.test.ts` for the pattern.
- Cover it with a normal vitest test so the behavior is locked in and debuggable
  locally.
- In the workflow, the `run:` step should only call the script
  (`node packages/tbd/scripts/extract-changelog.mjs …`) and wire its output; keep any
  remaining shell to trivial plumbing (e.g. the `GITHUB_OUTPUT` heredoc).

If you find yourself reaching for `awk`/`sed` in a workflow, that is the signal to move
it into a script.

## Project Structure

```
tbd/
├── packages/
│   └── tbd/               # Main CLI package
│       ├── src/
│       │   ├── index.ts   # Library entry (node-free)
│       │   ├── cli/       # CLI-specific code
│       │   │   ├── bin.ts
│       │   │   ├── cli.ts
│       │   │   ├── commands/
│       │   │   └── lib/
│       │   ├── lib/       # Core library (schemas, types)
│       │   ├── file/      # File layer
│       │   └── git/       # Git layer
│       └── tests/
├── scripts/               # Development scripts
├── docs/                  # Documentation
└── .github/workflows/     # CI/CD (release.yml publishes on v* tags)
```

## Architecture

See [tbd-design.md](tbd-design.md) for the full design document.

Key concepts:

- **File Layer**: Markdown and YAML front matter format
- **Git Layer**: Sync via dedicated `tbd-sync` branch
- **CLI Layer**: Commander.js with Beads-compatible commands

## CLI Patterns

The CLI follows patterns from
[research-modern-typescript-cli-patterns.md](general/research/current/research-modern-typescript-cli-patterns.md):

- Base Command pattern for shared functionality
- Dual output mode (text and JSON)
- OutputManager for consistent output handling
- Proper stdout/stderr separation

## Worktree Architecture

tbd uses a **hidden git worktree** to store issue data on the `tbd-sync` branch while
keeping the user’s working directory clean.
The sync worktree is anchored under Git’s common directory so the main checkout and any
linked worktrees created by tools like Codex all share the same local issue state.
See [tbd-design.md §2.3](packages/tbd/docs/tbd-design.md#23-hidden-worktree-model) for
the full specification.

### Why Worktree?

- **Fast search**: ripgrep can search issues without git plumbing commands
- **Direct file access**: Read/write issues as regular files, no
  `git show`/`git cat-file`
- **Isolated from main**: Issues don’t pollute working directory or affect main branch
- **Conflict-free across linked worktrees**: One shared worktree owns `tbd-sync`, and a
  repo-scoped lock serializes mutations

### Path Conventions

```
.tbd/                               # Config directory (on main branch)
│
│ Committed to the repo:
├── config.yml                      # Project configuration
├── .gitignore                      # Controls what's gitignored below
├── workspaces/                     # Persistent state (outbox, named workspaces)
│   └── outbox/                     # Sync failure recovery data
│
│ Gitignored (local only):
├── state.yml                       # Local state
├── docs/                           # Installed documentation (regenerated on setup)
└── backups/                        # Legacy local backups

$GIT_COMMON_DIR/tbd/                # Shared by all linked worktrees of this repo
├── layout.yml                      # Common-dir layout metadata (same f04 format ID)
├── locks/
│   └── data-sync.lock/             # mkdir-based repo-scoped lock
├── backups/                        # Shared migration/repair backups
└── data-sync-worktree/             # Hidden worktree
    └── .tbd/data-sync/             # Actual issue storage (on tbd-sync branch)
        ├── issues/
        ├── mappings/
        ├── attic/
        └── meta.yml
```

**CRITICAL**: Issues must be written to the **worktree path**
(`$GIT_COMMON_DIR/tbd/data-sync-worktree/.tbd/data-sync/issues/`), NOT the direct path
(`.tbd/data-sync/issues/`). The direct path is gitignored and exists only as a legacy
diagnostic/migration location.

### Key Source Files

- `packages/tbd/src/lib/paths.ts` - Path constants and `resolveDataSyncDir()`
- `packages/tbd/src/file/git.ts` - Worktree init/health/repair functions
- `packages/tbd/src/cli/commands/sync.ts` - Sync command with worktree checks
- `packages/tbd/src/cli/commands/doctor.ts` - Health checks and repair

### Worktree Health States

| State | Description | Fix |
| --- | --- | --- |
| `valid` | Worktree exists and has correct branch | None needed |
| `missing` | Worktree directory doesn’t exist | `tbd doctor --fix` |
| `prunable` | Directory deleted but git tracks it | `tbd sync --fix` |
| `corrupted` | Missing .git file or wrong branch | `tbd doctor --fix` |

### Common Failure Modes

1. **Worktree deleted manually**: User or tool deletes
   `$GIT_COMMON_DIR/tbd/data-sync-worktree/`. Git may still track it (prunable state).
   Fix: `tbd sync --fix` or `tbd doctor --fix`.

2. **Data in wrong location**: Bug or old code writes to `.tbd/data-sync/` instead of
   worktree. Fix: `tbd doctor --fix` migrates data to worktree.

3. **Fresh clone**: Repo cloned but worktree not created.
   `tbd setup --auto` or first sync creates it.

4. **Git version mismatch**: Orphan worktree requires Git 2.42+. Check: `git --version`,
   update if needed.

### Debugging Tips

```bash
# Check worktree health
tbd doctor

# Verbose sync for debugging
tbd sync --debug

# List git worktrees
git worktree list

# Check what git thinks about the worktree
git worktree list --porcelain

# Manually prune stale worktree entries
git worktree prune

# Enable debug logging for path resolution
DEBUG=1 tbd sync
# or
TBD_DEBUG=1 tbd sync
```

### Testing Worktree Code

Run the worktree health tests:

```bash
npx vitest run tests/worktree-health.test.ts
```

Run the e2e worktree scenarios:

```bash
npx tryscript run tests/cli-sync-worktree-scenarios.tryscript.md
```

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
