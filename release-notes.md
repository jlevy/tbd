## What’s Changed

### Fixes

- **`tbd show` dependency direction**: Now renders `Blocks:` and `Blocked by:` comments
  in text output so dependency direction is unambiguous, while preserving round-trip
  YAML parsing. Fixes #119.
- **`tbd doctor` temp file check**: Now reports the actual scanned path
  (`.tbd/data-sync/issues`) instead of the stale `.tbd/issues`, and catches
  `atomically`’s `*.md.tmp-NNNN` leftover intermediates in addition to plain `*.tmp`
  files.

### Documentation

- **Refreshed coding guidelines** (loaded via `tbd guidelines <name>`) to May 2026
  versions: Bun 1.3.x monorepo, pnpm 11 monorepo, TypeScript 6.0 / 7.0 Beta, TypeScript
  CLI tooling, code coverage, YAML handling.
  Covers ESLint 10, Vitest 4.1, Zod 4, Commander 15, Biome 2.4, and current best
  practices.
- **New supply-chain mitigation policy** in both `bun-monorepo-patterns` and
  `pnpm-monorepo-patterns` guidelines: codifies a normative 14-day package-age rule with
  lockfile discipline, provenance checks, and an exception process.

### Security

- **`yaml` bumped to ~2.8.3** (resolves to `yaml@2.8.4`): patches
  [GHSA-48c2-rrv3-qjmp](https://github.com/advisories/GHSA-48c2-rrv3-qjmp) (moderate;
  stack-overflow DoS on deeply nested YAML parsing).
  Range narrowed from `^2.8.2` to `~2.8.3` so the resolved minor satisfies the project’s
  14-day package-age rule.
- **No other dependency changes**: aside from the `yaml` bump and its peer-resolution
  string updates in `vitest`/`vite`, the resolved dependency tree is unchanged from
  v0.1.27. Root `package.json` adds `--cooldown 14` to the `upgrade*` scripts and a new
  `check:package-age` script (no new deps).
- **Pre-existing dev-only advisories** (15, unchanged from v0.1.27): transitive through
  `vitest`, `c8`, `tsdown`, `@changesets/cli`, and `typescript-eslint`; not shipped to
  users.

**Full commit history**: https://github.com/jlevy/tbd/compare/v0.1.27...v0.1.28
