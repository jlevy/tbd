## What’s Changed

### Fixes

- **Fix `--no-auto-save` and `--no-outbox` flag handling in sync**: Commander.js
  `--no-*` flags were not being read correctly, causing auto-save and outbox import to
  run even when explicitly disabled.
  Both flags now work as expected.

- **Stop writing GitHub issue URL into user `.gitattributes`**: The setup command no
  longer writes external GitHub issue URLs into project `.gitattributes` files.

- **Remove unused `--non-interactive` and `--yes` CLI flags**: These global flags were
  defined but never used.
  Removed to keep the CLI surface clean.

- **Fix Windows CI timeout**: Increased timeout for the fresh-clone doctor test which
  performs extensive git operations that exceed 15s on Windows CI runners.

### Docs

- Updated pnpm-monorepo-patterns and bun-monorepo-patterns guidelines with ESM-only,
  OIDC, and Biome 2.x sections.
- Rewrote typescript-cli-tool-rules to match actual codebase patterns.

**Full commit history**: https://github.com/jlevy/tbd/compare/v0.1.22...v0.1.23
