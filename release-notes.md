## What’s Changed

### Breaking Changes

- **Package renamed**: `tbd-git` → `get-tbd`. The old package is deprecated on npm with
  a message pointing to `get-tbd`. Update with: `npm install -g get-tbd`

### Features

- **`--specs` flag for `tbd list`**: Group issues by their associated spec document
- **`--add`/`--name` options**: Add items and filter by name in guidelines, shortcut,
  and template commands

### Fixes

- **Project-local hook installation**: Hooks now always install to project `.claude/`
  directory (removed global `~/.claude/` fallback), fixing issues in cloud environments
- **Git root resolution**: Setup correctly resolves to git root for `.claude/` and
  `.tbd/` placement
- **Deterministic sort order**: Ready, stale, and blocked commands now sort by ID as
  secondary key

### Refactoring

- Extracted GitHub fetch into shared utility module
- Added comparison-chain utility for fluent multi-field sorting

### Documentation

- Bun monorepo architecture patterns research
- TypeScript sorting patterns guidelines

**Full commit history**: https://github.com/jlevy/tbd/compare/v0.1.7...v0.1.8
