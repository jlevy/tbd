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

**Full commit history**: https://github.com/jlevy/tbd/compare/v0.1.27...v0.1.28
