---
title: pnpm Monorepo Patterns
description: Modern patterns for pnpm-based TypeScript monorepo architecture
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# pnpm Monorepo Patterns

**Last Updated**: 2026-05-21

**Related**:

- [pnpm Workspaces Documentation](https://pnpm.io/workspaces)
- [Changesets Documentation](https://github.com/changesets/changesets)
- [tsdown Documentation](https://tsdown.dev/)
- [publint Documentation](https://publint.dev/docs/)
- [Companion: Bun Monorepo Patterns](./bun-monorepo-patterns.md)
- [Supply-Chain Mitigation](#supply-chain-mitigation) (in this document)

* * *

## Updating This Document

### Last Researched Versions

| Tool / Package | Version | Check For Updates |
| --- | --- | --- |
| **Node.js** | 24 (LTS “Krypton”) | [nodejs.org/releases](https://nodejs.org/en/about/previous-releases) — Node 24 Active LTS until Oct 2026. **Node 26 Current** shipped 2026-05-05 (Temporal API enabled by default, V8 14.6, Undici 8.0). **Node 20 went EOL 2026-03-24.** Node 26 is the last release on the old two-major-per-year cadence; starting v27, all majors become LTS (one per year). |
| **pnpm** | ^11.0.0 (11.2.x too recent) | [github.com/pnpm/pnpm/releases](https://github.com/pnpm/pnpm/releases) — **Pinned to 11.0.0 (2026-04-28) per the 14-day rule**; 11.2.0/11.2.2 shipped 2026-05-20/21 (1–2 days old today). Breaking changes: pure ESM (requires **Node 22+**); SQLite-based store (`$STORE/index.db`); **`minimumReleaseAge` defaults to 1440 minutes (1 day)** for supply-chain hygiene; **`blockExoticSubdeps` defaults to `true`**; `onlyBuiltDependencies`/`neverBuiltDependencies` removed and replaced by **`allowBuilds`**; `patchedDependencies` format simplified; experimental Rust-based `@pnpm/pacquet` engine arrives in 11.2+. v11.1 added `pnpm audit signatures`, `pnpm bugs`, `pnpm owner`. |
| **TypeScript** | ^6.0.3 | [github.com/microsoft/TypeScript/releases](https://github.com/microsoft/TypeScript/releases) — **6.0.3 stable** (shipped 2026-03-23). 6.0 is the last JavaScript-based release; `strict: true` is now the default, ESM is the default module system, ~9 compiler settings flipped defaults. **TS 7.0 Beta** (Project Corsa, Go rewrite) shipped 2026-04-21 as `@typescript/native-preview` (binary: `tsgo`); claims ~10× type-check speed and ~3× less memory. Stable expected mid-to-late 2026. Do not adopt `tsgo` for production builds yet. |
| **tsdown** | ^0.22.0 | [github.com/rolldown/tsdown/releases](https://github.com/rolldown/tsdown/releases) — 0.22.0 (2026-05-07). Has not reached 1.0; incremental 0.20→0.22 releases since Feb 2026; no deprecations. Requires Node.js 20.19+. |
| **publint** | ^0.3.20 (0.3.21 too recent) | [npmjs.com/package/publint](https://www.npmjs.com/package/publint) — **Pinned to 0.3.20 (2026-05-08) per the 14-day rule**; 0.3.21 (2026-05-13) is 9 days old today. Re-enabled TS/TSX file existence checks; `exports["default"]` support; bug fixes. |
| **@changesets/cli** | ^2.31.0 | [github.com/changesets/changesets/releases](https://github.com/changesets/changesets/releases) — 2.31.0 latest. No native Bun support added. |
| **@types/node** | ^24.0.0 | [@types/node npm](https://www.npmjs.com/package/@types/node) — Track Node.js major version. @types/node@25.x available; @types/node@26.x will follow Node 26. |
| **actions/checkout** | v6 | [github.com/actions/checkout/releases](https://github.com/actions/checkout/releases) — v6.0.2 (2026-01-09). Credentials now stored in `$RUNNER_TEMP` rather than `.git/config`; Node 24 runtime; requires runner ≥ 2.327.1. |
| **actions/setup-node** | v6 | [github.com/actions/setup-node/releases](https://github.com/actions/setup-node/releases) — Supports Node 24 by default. **Note GitHub’s 2026-06-02 deadline forcing Node.js 20 actions to Node.js 24.** |
| **pnpm/action-setup** | v6 | [github.com/pnpm/action-setup/releases](https://github.com/pnpm/action-setup/releases) — **v6 required for pnpm 11+ support.** v4 (previously documented) does not handle pnpm 11’s ESM-only distribution correctly. |
| **changesets/action** | v1 | [github.com/changesets/action](https://github.com/changesets/action) — Still v1. No v2. |
| **lefthook** | ^2.1.5 (2.1.7/2.1.8 too recent) | [github.com/evilmartians/lefthook/releases](https://github.com/evilmartians/lefthook/releases) — **Pinned to 2.1.5 (2026-04-06) per the 14-day rule**; 2.1.7/2.1.8 both shipped 2026-05-19. Patch-level since 2.1.1. v2 still excludes regexp `exclude` and `skip_output` from v1. |
| **npm-check-updates** | ^22.0.0 (22.2.0 too recent) | [npmjs.com/package/npm-check-updates](https://www.npmjs.com/package/npm-check-updates) — **Major version jump from 19 to 22.** **Pinned to 22.0.0 (2026-04-25) per the 14-day rule**; 22.2.0 (2026-05-12) is 10 days old today. Now pure ESM; named imports only (`import { run } from 'npm-check-updates'`); `.ncurc.js` with `module.exports` no longer works in `"type": "module"` projects (use `.ncurc.cjs`). **Ships `--cooldown <days>` to refuse versions younger than the specified age** — primary enforcement for the 14-day package-age rule. See [Supply-Chain Mitigation](#supply-chain-mitigation). |
| **tsx** | ^4.21.0 (4.22.x too recent) | [github.com/privatenumber/tsx/releases](https://github.com/privatenumber/tsx/releases) — **Pinned to 4.21.0 (2025-11-30) per the 14-day rule**; 4.22.0 shipped 2026-05-14 (8 days old) and 4.22.3 shipped 2026-05-19 (3 days old). Bump on next refresh once 4.22.x has aged. |
| **prettier** | ^3.8.3 | [github.com/prettier/prettier/releases](https://github.com/prettier/prettier/releases) — 3.8.3 stable. Prettier 4.0 is in alpha (4.0.0-alpha.13, CLI performance rewrite) — **not stable yet**; do not adopt. |
| **eslint-config-prettier** | ^10.0.0 | [github.com/prettier/eslint-config-prettier/releases](https://github.com/prettier/eslint-config-prettier/releases) |
| **ESLint** | ^10.0.0 | [github.com/eslint/eslint/releases](https://github.com/eslint/eslint/releases) — **ESLint 10.0.0 shipped 2026-02-06.** **Breaking**: `.eslintrc.*` configuration is completely removed — flat config (`eslint.config.js`) is the only supported format. Download size reduced (11 MB → 9.4 MB). Improved JSX reference tracking. **Minimum Node.js v20.19.0.** ESLint 9.x EOL is 2026-08-06. |
| **Vitest** | ^4.1.5 (4.1.6/4.1.7 too recent) | [github.com/vitest-dev/vitest/releases](https://github.com/vitest-dev/vitest/releases) — **Pinned to 4.1.5 (2026-04-21) per the 14-day rule**; 4.1.7 (2026-05-20) is 2 days old today. v4.1 (Mar 2026) added Vite 8 support, test tags, extended chai-style assertions for mocking. Vitest now reuses installed Vite instead of bundling. Browser Mode stable, visual regression added. `coverage.all` was removed in v4. Vitest 5.0.0-beta.3 in pre-release (requires Node 22+, Vite 6.4+) — **do not adopt yet**. |
| **Zod** | ^4.4.3 | [github.com/colinhacks/zod/releases](https://github.com/colinhacks/zod/releases) — **Zod 4 fully stable.** 14× faster string parsing, 7× faster array parsing, 6.5× faster object parsing vs Zod 3; core bundle 2.3× smaller. New `@zod/mini` package (~1.9 KB gzipped) for tree-shakable frontend validation. Migration from Zod 3 required — see [zod.dev/v4/changelog](https://zod.dev/v4/changelog). |
| **commander** | ^15.0.0 | [github.com/tj/commander.js/releases](https://github.com/tj/commander.js/releases) — Commander 15 shipping May 2026, **ESM-only, requires Node v22.12.0+**. Commander 14 moves to maintenance (security only) until May 2027. |
| **picocolors** | ^1.1.1 | [npmjs.com/package/picocolors](https://www.npmjs.com/package/picocolors) — Last release October 2024. Stable; no changes expected. |
| **dotenv** | ^17.4.2 | [npmjs.com/package/dotenv](https://www.npmjs.com/package/dotenv) — Stable. **Prefer Node.js native `--env-file` for Node ≥20.6** (production-ready since Node 24 LTS); use dotenv only when you need variable expansion, multiline values, or custom precedence logic. |
| **atomically** | ^2.1.1 | [npmjs.com/package/atomically](https://www.npmjs.com/package/atomically) — 2.1.1 (2026-02-08). Still maintained. |
| **yaml** | ^2.8.4 | [npmjs.com/package/yaml](https://www.npmjs.com/package/yaml) — 2.8.4 (2026-05-02). v3.0.0-1 is tagged “next” (pre-release) — do not adopt yet. |
| **@vitest/coverage-v8** | ^4.1.7 | [npmjs.com/package/@vitest/coverage-v8](https://www.npmjs.com/package/@vitest/coverage-v8) — Track Vitest version. |

### Reminders When Updating

1. **Check each version** in the table above using the linked release pages

2. **Update the table** with new versions and any relevant notes

3. **Search and update code examples** — version numbers appear in:

   - GitHub Actions workflows (CI and Release sections)

   - `tsdown.config.ts` examples (`target: "node24"`)

   - `tsconfig.base.json` examples (`target`/`lib` should match Node.js ES version)

   - `package.json` examples (`engines`, `packageManager`, `devDependencies`)

   - Appendices A, B, and D (complete examples)

4. **Verify compatibility** — check that tools still work together (e.g., new
   pnpm/action-setup versions may change caching behavior)

5. **Update the “Last Updated” date** at the top of the document

6. **Review “Open Research Questions”** section for any resolved items

7. **Honor the 14-day package-age rule** when bumping versions in code examples.
   See [Supply-Chain Mitigation](#supply-chain-mitigation) — versions cited here should
   be ≥14 days old at the time the table is updated, except where a clearly-noted
   security exception applies.

* * *

## Executive Summary

This research brief provides a comprehensive guide for setting up a modern TypeScript
package that can start as a single package and grow into a multi-package monorepo.
The architecture prioritizes fast iteration during early development while maintaining a
clear path to split packages later without breaking changes.

The recommended stack uses **pnpm workspaces** for dependency management, **tsdown** for
building ESM/CJS dual outputs with TypeScript declarations, **Changesets**
(multi-package monorepos) or **tag-triggered OIDC publishing** (single-package repos)
for versioning and release automation, **publint** for validating package
publishability, and **lefthook** for fast local git hooks.
This approach supports private development via GitHub Packages or direct GitHub
installs, with a seamless transition to public npm publishing when ready.

**Research Questions**:

1. What is the optimal monorepo structure for a TypeScript package that may grow from
   one to many packages?

2. How should modern TypeScript packages handle dual ESM/CJS output with proper type
   declarations?

3. What tooling provides the best developer experience for versioning, publishing, and
   CI/CD automation?

4. How can packages support optional peer dependencies (like AI SDKs or protocol
   integrations) without forcing them on users?

* * *

## Research Methodology

### Approach

Research was conducted through documentation review, web searches for current best
practices (2025), analysis of popular open-source monorepos, and evaluation of tooling
recommendations from the TypeScript and JavaScript ecosystem maintainers.

### Sources

- Official documentation (pnpm, TypeScript, Node.js, GitHub)

- Tool-specific documentation (tsdown, publint, Changesets)

- Developer blog posts and migration guides

- GitHub discussions and issue threads

- Real-world monorepo implementations (Effect-TS, TresJS)

* * *

## Research Findings

### 1. Package Manager and Workspace Structure

#### pnpm Workspaces

**Status**: Recommended

**Details**:

- pnpm offers disk space efficiency through content-addressable storage with symlinks

- Built-in workspace support without additional tools

- Strict `node_modules` prevents phantom dependencies (packages not explicitly declared)

- `workspace:` protocol ensures local packages are always used during development

- `pnpm deploy` command enables isolated production deployments for Docker

- **pnpm 11 (shipped 2026-04-28)** adds significant supply-chain hardening defaults:
  `minimumReleaseAge: 1440` (1 day) and `blockExoticSubdeps: true`. We recommend
  overriding `minimumReleaseAge` to 14 days — see
  [Supply-Chain Mitigation](#supply-chain-mitigation).

- **pnpm 11 is pure ESM and requires Node.js 22+.** Lifecycle script gating has moved
  from `onlyBuiltDependencies`/`neverBuiltDependencies` to **`allowBuilds`** (an
  explicit allowlist).

- The store is now a single SQLite database (`$STORE/index.db`) for faster cache reads;
  this is invisible to users but matters for CI cache configs.

**Assessment**: pnpm remains the consensus choice for TypeScript monorepos, with pnpm 11
adding meaningful supply-chain defaults and faster store I/O.

**Key Configuration** (`pnpm-workspace.yaml`):

```yaml
packages:
  - 'packages/*'
  - 'apps/*'

# Supply-chain hardening (see Supply-Chain Mitigation section)
minimumReleaseAge: 20160       # 14 days in minutes
blockExoticSubdeps: true       # Default in pnpm 11; explicit is good
allowBuilds:                   # Replaces onlyBuiltDependencies in pnpm 11
  - esbuild
  - sharp
```

**Root `.npmrc`**:

```ini
save-workspace-protocol=true
prefer-workspace-packages=true
# Belt-and-suspenders with pnpm-workspace.yaml above:
minimum-release-age=20160
```

**References**:

- [pnpm Workspaces](https://pnpm.io/workspaces)

- [Complete Monorepo Guide 2025](https://jsdev.space/complete-monorepo-guide/)

* * *

#### Monorepo Structure Strategy

**Status**: Recommended

**Details**:

The “start mono, stay sane” approach places packages in `packages/` from day one, even
if there’s only one package initially.
This prevents restructuring when adding new packages later.

**Recommended Directory Structure**:

```
project-root/
  .changeset/
    config.json
    README.md
  .github/
    workflows/
      ci.yml
      release.yml
  packages/
    package-name/
      src/
        core/           # Future: package-name-core
        cli/            # Future: package-name-cli
        adapters/       # Future: package-name-adapters
        bin.ts
        index.ts
      package.json
      tsconfig.json
      tsdown.config.ts
  .gitignore
  .npmrc
  eslint.config.js
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
```

**Assessment**: Starting with a monorepo structure from day one has minimal overhead and
prevents painful restructuring later.
Internal code organization (`core/`, `cli/`, `adapters/`) creates natural split points.

**References**:

- [Setting up a monorepo with pnpm and TypeScript](https://brockherion.dev/blog/posts/setting-up-a-monorepo-with-pnpm-and-typescript/)

- [Wisp CMS: How to Bootstrap a Monorepo with PNPM](https://www.wisp.blog/blog/how-to-bootstrap-a-monorepo-with-pnpm-a-complete-guide)

* * *

### 2. TypeScript Configuration

#### Base Configuration

**Status**: Recommended

**Details**:

Modern TypeScript monorepos use a shared base configuration extended by each package.

**`tsconfig.base.json`**:

```json
{
  "compilerOptions": {
    "target": "ES2024",
    "lib": ["ES2024"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "strict": true,
    "skipLibCheck": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true,
    "verbatimModuleSyntax": true
  }
}
```

**Package-level `tsconfig.json`**:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["node"],
    "noEmit": true
  },
  "include": ["src"]
}
```

**Note on target/lib version**: Use `ES2024` when targeting Node.js 22+ (which supports
all ES2024 features).
Use `ES2023` if your minimum is Node.js 20. The target should match what your
`engines.node` field supports.

**Assessment**: Using `moduleResolution: "Bundler"` is appropriate when a bundler
(tsdown) handles the final output.
For maximum Node.js compatibility without a bundler, `NodeNext` would be preferred.
Since tsdown generates proper ESM and CJS with correct extensions, `Bundler` mode works
well.

**References**:

- [TypeScript: Choosing Compiler Options](https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options.html)

- [Is nodenext right for libraries?](https://blog.andrewbran.ch/is-nodenext-right-for-libraries-that-dont-target-node-js/)

* * *

#### moduleResolution: Bundler vs NodeNext

**Status**: Situational

**Details**:

| Aspect | `Bundler` | `NodeNext` |
| --- | --- | --- |
| File extensions | Not required in imports | Required (.js extension) |
| Use case | When bundler handles output | Direct Node.js execution |
| Library compatibility | Requires bundler-aware consumers | Works everywhere |
| Type generation | Must ensure .d.ts aligns with output | Naturally aligned |

**Key insight**: `NodeNext` is “infectious” in a good way—code that works in Node.js
typically works in bundlers too.
However, `Bundler` is acceptable when using tsdown since it handles file extensions
correctly.

**Assessment**: Use `Bundler` for simplicity during development when tsdown generates
the final output. The bundler handles the complexity of module resolution.

**References**:

- [TypeScript moduleResolution documentation](https://www.typescriptlang.org/tsconfig/moduleResolution.html)

- [Live types in a TypeScript monorepo](https://colinhacks.com/essays/live-types-typescript-monorepo)

* * *

### 3. Build Tooling

#### tsdown

**Status**: Strongly Recommended

**Details**:

tsdown is the modern successor to tsup, built on Rolldown (the Rust-based bundler from
the Vite ecosystem).
Key advantages:

- **ESM-first**: Properly handles file extensions in ESM output (a pain point with tsup)

- **Dual format output**: Generates both ESM (`.js`) and CJS (`.cjs`) from the same
  source

- **TypeScript declarations**: Built-in `.d.ts` and `.d.cts` generation

- **Multi-entry support**: Build multiple entry points (library, CLI, adapters) in one
  config

- **Plugin ecosystem**: Compatible with Rollup, Rolldown, and most Vite plugins

- **Fast**: Powered by Rust-based Oxc and Rolldown

- **Isolated declarations**: Supports TypeScript 5.5+ `--isolatedDeclarations` for
  faster type generation

**Migration from tsup**: tsdown provides a `migrate` command and is compatible with most
tsup configurations.

**Configuration (`tsdown.config.ts`)**:

```typescript
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli/index.ts',
    adapter: 'src/adapters/index.ts',
    bin: 'src/bin.ts',
  },
  format: ['esm', 'cjs'],
  platform: 'node',
  target: 'node24',
  sourcemap: true,
  dts: true,
  clean: true,
  banner: ({ fileName }) => (fileName.startsWith('bin.') ? '#!/usr/bin/env node\n' : ''),
});
```

**Assessment**: tsdown is the recommended choice for new TypeScript library projects.
It has official backing from the Vite/Rolldown team and will become the foundation for
Rolldown Vite’s Library Mode.

**Note on tsup**: tsup is no longer actively maintained.
The project recommends migrating to tsdown.

**References**:

- [tsdown Introduction](https://tsdown.dev/guide/)

- [Switching from tsup to tsdown](https://alan.norbauer.com/articles/tsdown-bundler/)

- [Migrate from tsup](https://tsdown.dev/guide/migrate-from-tsup)

- [TresJS tsdown Migration](https://tresjs.org/blog/tresjs-tsdown-migration)

- [Dual publish ESM and CJS with tsdown](https://dev.to/hacksore/dual-publish-esm-and-cjs-with-tsdown-2l75)

* * *

#### ESM-Only Alternative (Node.js 22+)

**Status**: Recommended for Node.js-only packages

**When to use**: If your package targets Node.js 22+ exclusively and doesn’t need to
support CommonJS consumers (bundlers, older Node.js, or specific CJS-only tools), an
ESM-only build is simpler and sufficient.

**Simplified tsdown config**:

```typescript
export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm'],  // ESM only
  platform: 'node',
  target: 'node24',
  sourcemap: true,
  dts: true,
  clean: true,
});
```

**Simplified package.json exports**:

```json
{
  "type": "module",
  "main": "./dist/index.mjs",
  "types": "./dist/index.d.mts",
  "exports": {
    ".": {
      "types": "./dist/index.d.mts",
      "default": "./dist/index.mjs"
    }
  }
}
```

**Trade-offs**:

- ✅ Simpler config, smaller package, faster builds
- ✅ No dual-format complexity
- ❌ CJS consumers cannot use the package
- ❌ Some bundlers may require additional config

**Assessment**: ESM-only is the right choice for modern Node.js libraries.
Only provide dual ESM/CJS if you have confirmed CJS consumer requirements.

* * *

### 4. Package Exports and Dual Module Support

#### Subpath Exports

**Status**: Essential

**Details**:

The `exports` field in `package.json` enables:

- Multiple entry points (`./cli`, `./adapter`)

- Conditional exports (ESM vs CJS, types vs runtime)

- Package encapsulation (only expose intended APIs)

**Critical rule**: The `"types"` condition must come first in each export block.

**Example `package.json` exports**:

```json
{
  "name": "@scope/package-name",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.cts",
        "default": "./dist/index.cjs"
      }
    },
    "./cli": {
      "import": {
        "types": "./dist/cli.d.ts",
        "default": "./dist/cli.js"
      },
      "require": {
        "types": "./dist/cli.d.cts",
        "default": "./dist/cli.cjs"
      }
    },
    "./package.json": "./package.json"
  },
  "bin": {
    "package-name": "./dist/bin.js"
  },
  "files": ["dist"]
}
```

**Assessment**: Subpath exports are essential for future-proofing.
They allow splitting packages later without breaking the API surface—`@scope/pkg/cli`
can remain stable even if internals move to `@scope/pkg-cli`.

**References**:

- [Guide to package.json exports field](https://hirok.io/posts/package-json-exports)

- [Node.js Packages documentation](https://nodejs.org/api/packages.html)

- [Ship ESM & CJS in one Package](https://antfu.me/posts/publish-esm-and-cjs)

- [Building npm package compatible with ESM and CJS in 2024](https://snyk.io/blog/building-npm-package-compatible-with-esm-and-cjs-2024/)

* * *

#### Separate Declaration Files for ESM/CJS

**Status**: Required

**Details**:

Each entry point needs separate declaration files for ESM (`.d.ts`) and CJS (`.d.cts`).
TypeScript interprets declaration files as ESM or CJS based on file extension and the
package’s `type` field.

Using a single `.d.ts` for both formats will cause TypeScript errors for consumers using
one of the module systems.

**Assessment**: tsdown handles this automatically when `dts: true` is configured.

**References**:

- [TypeScript Modules Reference](https://www.typescriptlang.org/docs/handbook/modules/reference.html)

- [Publishing dual ESM+CJS packages](https://mayank.co/blog/dual-packages/)

* * *

### 5. Optional Peer Dependencies

#### Strategy for Optional Integrations

**Status**: Recommended

**Details**:

For packages that optionally integrate with external SDKs (AI SDKs, MCP servers, etc.),
use:

1. **Optional peer dependencies**: Don’t force installation

2. **Subpath exports**: Isolate optional code in separate entry points

3. **Dynamic imports**: Only load the SDK when the subpath is actually imported

**`package.json` configuration**:

```json
{
  "peerDependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "ai": "^5.0.0"
  },
  "peerDependenciesMeta": {
    "@modelcontextprotocol/sdk": { "optional": true },
    "ai": { "optional": true }
  }
}
```

**Implementation pattern** (`src/adapters/mcp/index.ts`):

```typescript
export async function createMcpServer(options: McpServerOptions) {
  // Dynamic import only when this code path is executed
  const { Server } = await import('@modelcontextprotocol/sdk/server');
  return new Server(options);
}
```

**Assessment**: This pattern ensures the main package remains lightweight while
providing rich integrations for users who need them.

**References**:

- [tsdown Dependencies handling](https://tsdown.dev/options/dependencies)

- [npm peer dependencies documentation](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#peerdependenciesmeta)

* * *

### 6. Package Validation

#### publint

**Status**: Essential

**Details**:

publint validates that packages will work correctly across different environments (Vite,
Webpack, Rollup, Node.js).
It checks:

- Export field validity

- File existence for declared exports

- ESM/CJS format correctness

- Type declaration alignment

- Common configuration mistakes

**Integration**:

```json
{
  "scripts": {
    "publint": "publint",
    "prepack": "pnpm build"
  },
  "devDependencies": {
    "publint": "^0.3.21"
  }
}
```

**CI Integration**: Run `pnpm publint` after build in CI to catch publishing issues
before release.

**Assessment**: publint catches issues that would only surface after users install the
package. Essential for any published package.

**References**:

- [publint documentation](https://publint.dev/docs/)

- [publint rules](https://publint.dev/rules)

* * *

### 7. Versioning and Release Automation

#### Changesets

**Status**: Recommended for multi-package monorepos (for a single published package,
prefer the tag-triggered approach below)

**Details**:

Changesets provides:

- **Intent-based versioning**: Developers declare the impact (patch/minor/major) when
  making changes

- **Automated changelogs**: Generated from changeset descriptions

- **Monorepo-aware**: Handles inter-package dependencies automatically

- **CI integration**: GitHub Action opens release PRs and publishes automatically

**Setup**:

1. Initialize: `pnpm add -Dw @changesets/cli && pnpm changeset init`

2. Configure `.changeset/config.json`:

```json
{
  "$schema": "https://unpkg.com/@changesets/config/schema.json",
  "changelog": "@changesets/changelog-github",  // or "@changesets/cli/changelog" for simpler output
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch"
}
```

3. Root scripts:

```json
{
  "scripts": {
    "changeset": "changeset",
    "version-packages": "changeset version",
    "release": "pnpm build && pnpm publint && changeset publish"
  }
}
```

**Workflow**:

1. Developer runs `pnpm changeset` and describes changes

2. PR includes the changeset file

3. On merge to main, GitHub Action either:

   - Opens a “Version Packages” PR (accumulating changesets)

   - Publishes to npm when that PR is merged

**Assessment**: Changesets is the de facto standard for *multi-package* monorepo
versioning and integrates seamlessly with pnpm and GitHub Actions.
For a repo that publishes a single package, its per-PR ceremony rarely pays off — prefer
the tag-triggered approach below (see the LLM-era note).

**References**:

- [Using Changesets with pnpm](https://pnpm.io/using-changesets)

- [Changesets GitHub repository](https://github.com/changesets/changesets)

- [Frontend Handbook: Changesets](https://infinum.com/handbook/frontend/changesets)

* * *

#### Alternative: Tag-Triggered OIDC Publishing

**Status**: Recommended for single-package repos, viable for monorepos

**Details**:

For simpler release workflows without Changesets, use tag-triggered GitHub Actions with
OIDC trusted publishing.
No NPM_TOKEN needed, no “Version Packages” PR workflow.

**Workflow**:

1. Manually bump version in package.json
2. Update CHANGELOG.md or release-notes.md
3. Commit, tag (e.g., `v1.2.3`), and push
4. GitHub Action publishes automatically on tag push

> **When to prefer this over Changesets (LLM-era note):** For a **single published
> package**, Changesets’ main wins (multi-package coordination and per-PR changelog
> accumulation) mostly evaporate, while its ceremony (a `.changeset/*.md` per PR, a
> bump-type decision per PR, the `changeset version` step, a “Version Packages” PR)
> stays. When releases are cut by an agent/maintainer who assembles notes from clean
> conventional commits at release time (see a release-notes template), tag-triggered
> publishing is simpler and has fewer moving parts: clean commits → bump + `## X.Y.Z`
> CHANGELOG section → tag → auto-publish.
> `tbd` itself uses this approach (project-local `docs/publishing.md` for the per-repo
> playbook; the workflow itself is the GitHub Action triggered by the `v*` tag).
> Keep Changesets when you publish several interdependent packages or want contributors
> to declare intent in each PR.

**One-time setup**:

1. Publish package manually once: `npm publish --access public`
2. Configure OIDC on npmjs.com → package settings → Trusted Publishing:
   - Publisher: GitHub Actions
   - Organization: your-org
   - Repository: your-repo
   - Workflow: `release.yml`

**Release workflow** (`.github/workflows/release.yml`):

```yaml
name: Release

on:
  push:
    tags: ['v*']

permissions:
  contents: write
  id-token: write  # Required for OIDC

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v6

      - uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: pnpm
          registry-url: 'https://registry.npmjs.org'

      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm publint

      - name: Publish to npm
        run: pnpm -r publish --access public --no-git-checks
        env:
          NPM_CONFIG_PROVENANCE: true  # Automatic provenance attestation

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          body_path: release-notes.md
```

**Advantages**:

- No NPM_TOKEN secret to manage or rotate
- Provenance attestation included automatically
- Simpler workflow (no Changesets PR dance)
- Works with existing git tag practices

**Disadvantages**:

- Manual version bumps (vs Changesets automation)
- No automated changelog generation
- Requires public GitHub repository

**Assessment**: Ideal for single-package repos or teams comfortable with manual
versioning. For large monorepos with many packages, Changesets provides better
automation.

**References**:

- [npm Trusted Publishing](https://docs.npmjs.com/generating-provenance-statements)
- [GitHub OIDC tokens](https://docs.github.com/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)

* * *

#### Dynamic Git-Based Versioning

**Status**: Recommended for dev builds

**Details**:

While Changesets handles release versioning, development builds benefit from dynamic
git-based version strings.
This provides traceability during development without manual version bumps.

**Format**: `X.Y.Z-dev.N.hash`

| State | Format | Example |
| --- | --- | --- |
| On tag | `X.Y.Z` | `1.2.3` |
| After tag | `X.Y.Z-dev.N.hash` | `1.2.4-dev.12.a1b2c3d` |
| Dirty working dir | `X.Y.Z-dev.N.hash-dirty` | `1.2.4-dev.12.a1b2c3d-dirty` |
| No tags | `X.Y.Z-dev.N.hash` | `0.1.0-dev.42.a1b2c3d` (uses package.json version + total commits) |

**Key design decisions**:

1. **Bump patch for dev versions**: Ensures correct semver sorting—dev versions sort
   *before* the next release, not after the current one

2. **Hash in pre-release, not metadata**: npm strips build metadata (`+hash`), so embed
   the hash in the pre-release identifier (`-dev.N.hash`)

3. **Dirty marker**: Identifies uncommitted changes during development

4. **No git dependency in runtime**: The published package should not depend on git
   being present. Git version detection happens only at build time or in dev scripts.

5. **Single source of truth**: Extract version logic to a shared script that both the
   build config and dev scripts can use.

**Why roll your own?**

No npm package provides build-time git version injection with env var support for dev
mode:

| Package | Issue |
| --- | --- |
| [git-describe](https://github.com/tvdstaaij/node-git-describe) | Last updated 2019, abandoned |
| [version-from-git](https://github.com/compulim/version-from-git) | Modifies package.json, not build-time injection |
| [esbuild-plugin-version-injector](https://github.com/favware/esbuild-plugin-version-injector) | Only injects package.json version, no git info |
| [rollup-plugin-git-version](https://www.npmjs.com/package/rollup-plugin-git-version) | Rollup-only, abandoned (2018) |

The ~60 lines of custom code is dependency-free, bundler-agnostic, and handles all edge
cases (no tags, dirty state, dev mode).
Python’s [setuptools-scm](https://github.com/pypa/setuptools-scm) is the gold standard;
this pattern is “setuptools-scm lite” for Node.js.

**Architecture Overview**:

The versioning system works in three contexts:

| Context | Version Source | Example |
| --- | --- | --- |
| Production build | Build-time injection via `__TBD_VERSION__` | `1.2.4-dev.12.a1b2c3d` |
| Dev mode (tsx) | Environment variable `TBD_DEV_VERSION` | `1.2.4-dev.12.a1b2c3d` |
| Fallback | package.json version | `0.1.0` |

**File Structure**:

```
packages/my-cli/
├── scripts/
│   ├── git-version.mjs      # Shared git version logic (not distributed)
│   └── git-version.d.mts    # TypeScript declarations
├── src/
│   ├── index.ts             # Library entry with VERSION constant
│   └── cli/
│       └── lib/
│           └── version.ts   # CLI version resolution (no git dependency)
└── tsdown.config.ts         # Imports from scripts/git-version.mjs
```

**Step 1: Shared Git Version Script** (`scripts/git-version.mjs`):

```js
/* global process, console */
/**
 * Git-based version detection for build and dev scripts.
 * Format: X.Y.Z-dev.N.hash
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(__dirname, '../package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

function git(args) {
  return execSync(`git ${args}`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

function isDirty() {
  try {
    git('diff --quiet');
    git('diff --cached --quiet');
    return false;
  } catch {
    return true;
  }
}

export function getGitVersion() {
  // Try tag-based version first
  try {
    const tag = git('describe --tags --abbrev=0');
    const tagVersion = tag.replace(/^v/, '');
    const [major, minor, patch] = tagVersion.split('.').map(Number);
    const commitsSinceTag = parseInt(git(`rev-list ${tag}..HEAD --count`), 10);
    const hash = git('rev-parse --short=7 HEAD');
    const dirty = isDirty();

    if (commitsSinceTag === 0 && !dirty) {
      return tagVersion;
    }

    const bumpedPatch = (patch ?? 0) + 1;
    const suffix = dirty ? `${hash}-dirty` : hash;
    return `${major}.${minor}.${bumpedPatch}-dev.${commitsSinceTag}.${suffix}`;
  } catch {
    // No tags - use package.json version with total commit count
    try {
      const totalCommits = parseInt(git('rev-list --count HEAD'), 10);
      const hash = git('rev-parse --short=7 HEAD');
      const dirty = isDirty();
      const suffix = dirty ? `${hash}-dirty` : hash;
      return `${pkg.version}-dev.${totalCommits}.${suffix}`;
    } catch {
      // Not a git repo
      return pkg.version;
    }
  }
}

// When run directly, print version to stdout
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(getGitVersion());
}
```

**Step 2: TypeScript Declarations** (`scripts/git-version.d.mts`):

```ts
/**
 * Get git-based version string.
 * Format: X.Y.Z-dev.N.hash
 */
export function getGitVersion(): string;
```

**Step 3: Build Config** (`tsdown.config.ts`):

```ts
import { defineConfig } from 'tsdown';
import { getGitVersion } from './scripts/git-version.mjs';

const version = getGitVersion();

export default defineConfig({
  // ...
  define: {
    __TBD_VERSION__: JSON.stringify(version),
  },
});
```

**Step 4: Library Entry** (`src/index.ts`):

```ts
declare const __TBD_VERSION__: string;

export const VERSION: string =
  typeof __TBD_VERSION__ !== 'undefined' ? __TBD_VERSION__ : 'development';
```

**Step 5: CLI Version Module** (`src/cli/lib/version.ts`):

```ts
/**
 * CLI version detection - no git dependency at runtime
 *
 * Priority:
 * 1. Build-time injected __TBD_VERSION__ (production builds)
 * 2. TBD_DEV_VERSION env var (dev mode, set by pnpm tbd script)
 * 3. package.json version (fallback)
 */
import { createRequire } from 'node:module';
import { VERSION as BUILD_VERSION } from '../../index.js';

function getVersion(): string {
  // 1. Build-time injected version (production)
  if (BUILD_VERSION !== 'development') {
    return BUILD_VERSION;
  }

  // 2. Dev mode env var (set by pnpm tbd script)
  if (process.env.TBD_DEV_VERSION) {
    return process.env.TBD_DEV_VERSION;
  }

  // 3. Fallback to package.json version
  const require = createRequire(import.meta.url);
  const pkg = require('../../../package.json') as { version: string };
  return pkg.version;
}

export const VERSION = getVersion();
```

**Step 6: Dev Script** (`package.json`):

```json
{
  "scripts": {
    "dev": "TBD_DEV_VERSION=$(node scripts/git-version.mjs) tsx src/cli/bin.ts"
  }
}
```

**Why This Pattern**:

| Concern | Solution |
| --- | --- |
| No git in runtime | Git logic only in scripts/ (not distributed) |
| Dev mode works | Env var passes version from script to tsx |
| Production works | Build-time injection via define |
| Single source of truth | One implementation in git-version.mjs |
| TypeScript support | Declaration file for type checking |
| Fallback safety | Graceful degradation to package.json |

**Comparison with Python (uv-dynamic-versioning)**:

| Aspect | npm (this approach) | Python (PEP 440) |
| --- | --- | --- |
| Format | `1.2.4-dev.12.a1b2c3d` | `1.2.4.dev12+a1b2c3d` |
| Metadata handling | In pre-release (preserved) | Local version `+` (may be stripped) |
| Sorting | Standard semver | PEP 440 compliant |
| Configuration | Shared script + bundler config | In `pyproject.toml` |

**Assessment**: This pattern provides the best balance of flexibility, maintainability,
and runtime independence.
Dynamic versioning complements Changesets—use Changesets for releases and git-based
versioning for development builds, with zero git dependency in the published package.

* * *

### 8. Testing

#### Vitest

**Status**: Recommended

**Details**:

Vitest is the recommended test runner for pnpm/Node.js monorepos.
It provides Jest-compatible APIs with native TypeScript and ESM support, powered by
Vite’s transformation pipeline.

**Key features**:

- Jest-compatible API (`describe`, `it`, `expect`, `vi.mock`, etc.)

- Native TypeScript and ESM support (no separate ts-jest)

- Watch mode with HMR (re-runs only affected tests)

- Snapshot testing

- Code coverage via v8 provider (built-in)

- Test isolation by default

- Browser Mode (stable in Vitest 4.0) for real browser testing

- Visual regression testing (added in Vitest 4.0)

- **Vitest 4.1 (Mar 2026)** added Vite 8 support, test tags for organizing tests, and
  extended chai-style assertions for mocking.
  Vitest now reuses the installed Vite instead of bundling a separate dependency.

- **`coverage.all` was removed in v4** — use `coverage.include` and `coverage.exclude`
  to control which files are reported.

- **Vitest 5.0.0-beta** is in pre-release (requires Node 22+ and Vite 6.4+). Stay on
  4.1.x for production until stable.

**Installation**:

```bash
pnpm add -D vitest @vitest/coverage-v8
```

**Running tests**:

```bash
pnpm vitest                    # Watch mode (default)
pnpm vitest run                # Run once
pnpm vitest --coverage         # With coverage
pnpm vitest --ui               # UI mode
```

**Configuration** (`vitest.config.ts`):

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/node_modules/**', '**/dist/**'],
    },
  },
});
```

**Example test**:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { processData } from '../src/index';

describe('processData', () => {
  it('handles valid input', () => {
    expect(processData({ key: 'value' })).toEqual({ key: 'VALUE' });
  });

  it('throws on invalid input', () => {
    expect(() => processData(null)).toThrow('Invalid input');
  });
});
```

**Comparison with other test runners**:

| Criteria | Vitest | Jest | Node test runner | Bun test |
| --- | --- | --- | --- | --- |
| Speed | Fast | Moderate | Fast | Fastest |
| Setup | Minimal config | Moderate config | Zero-config | Zero-config |
| TypeScript | Native | Via ts-jest | Via flag/tsx | Native |
| API | Jest-compatible | Jest | Node-native | Jest-compatible |
| Isolation | Isolated by default | Isolated | Isolated | No isolation |
| Browser Mode | Stable (v4.0) | Limited | None | None |
| Coverage | v8 built-in | Via jest-coverage | Built-in | Built-in |
| IDE support | Excellent | Excellent | Moderate | Basic |

**Assessment**: Vitest 4.0 is the mature choice for pnpm/Node.js monorepos, offering
test isolation, excellent IDE integration, browser mode for component testing, and full
Jest API compatibility.
Use it for all TypeScript monorepo projects.

**References**:

- [Vitest Documentation](https://vitest.dev/)

- [Vitest 4.0 Announcement](https://vitest.dev/blog/vitest-4)

- [Vitest Browser Mode](https://vitest.dev/guide/browser/)

* * *

### 9. CI/CD Configuration

#### GitHub Actions: CI Workflow

**Status**: Recommended

**`.github/workflows/ci.yml`** (minimal single-job):

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - uses: pnpm/action-setup@v6

      - uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm format:check
      - run: pnpm lint:check
      - run: pnpm build
      - run: pnpm publint
      - run: pnpm test
```

**Multi-job CI with cross-platform testing** (recommended for CLI tools):

```yaml
jobs:
  test:
    name: Test (${{ matrix.os }})
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    steps:
      - uses: actions/checkout@v6
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm test

  lint:
    name: Lint & Coverage
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm format:check
      - run: pnpm lint:check
      - run: pnpm build
      - run: pnpm publint
      - run: pnpm test:coverage
```

**Key points**:

- Node.js 24 is the current LTS ("Krypton", active until Oct 2026, maintained until Apr
  2028\)

- `actions/checkout@v6` requires Actions Runner v2.329.0+ (stores credentials under
  $RUNNER_TEMP)

- `pnpm/action-setup@v6` includes built-in caching (no `version:` needed if
  `packageManager` is set in `package.json`)

- `actions/setup-node@v6` with `cache: pnpm` provides additional caching

- `--frozen-lockfile` ensures CI uses exact versions from lockfile

- For CLI tools, cross-platform testing catches platform-specific issues (path
  separators, file permissions, line endings)

- Separating lint/coverage from tests enables parallel execution and clearer failure
  diagnosis

**References**:

- [pnpm action-setup](https://github.com/pnpm/action-setup)

- [pnpm Continuous Integration](https://pnpm.io/continuous-integration)

* * *

#### GitHub Actions: Release Workflow

**Status**: Recommended

**`.github/workflows/release.yml`**:

```yaml
name: Release

on:
  push:
    branches: [main]

permissions:
  contents: write
  pull-requests: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v6
        with:
          version: 10

      - uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: pnpm
          registry-url: 'https://registry.npmjs.org'

      - run: pnpm install --frozen-lockfile

      - name: Create Release PR or Publish
        uses: changesets/action@v1
        with:
          publish: pnpm release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Repository settings required**:

- Settings → Actions → General → Workflow permissions → **Read and write**

- Add `NPM_TOKEN` secret when ready to publish to npm

**References**:

- [Changesets GitHub Action](https://github.com/changesets/action)

- [Using Changesets with pnpm](https://pnpm.io/using-changesets)

* * *

### 10. Code Formatting

#### Prettier

**Status**: Essential

**Details**:

Prettier provides consistent code formatting across the project.
Configure it once and let it handle all formatting decisions automatically.

**Installation**:

```bash
pnpm add -Dw prettier eslint-config-prettier
```

**`.prettierrc`**:

```json
{
  "$schema": "https://json.schemastore.org/prettierrc",
  "printWidth": 100,
  "singleQuote": true,
  "trailingComma": "all",
  "semi": true,
  "arrowParens": "always",
  "tabWidth": 2,
  "useTabs": false
}
```

**`.prettierignore`**:

```
dist
node_modules
pnpm-lock.yaml
*.min.js
*.min.css
coverage
```

**Key configuration choices**:

| Option | Recommended | Rationale |
| --- | --- | --- |
| `printWidth` | 100 | Wider than default 80; fits modern screens |
| `singleQuote` | true | Common in JS ecosystem, less visual noise |
| `trailingComma` | “all” | Cleaner diffs, easier reordering |
| `semi` | true | Explicit; avoids ASI edge cases |

**Assessment**: Prettier eliminates formatting debates and ensures consistency.
Use `eslint-config-prettier` to disable ESLint rules that conflict with Prettier.

**References**:

- [Prettier Documentation](https://prettier.io/docs/)

- [eslint-config-prettier](https://github.com/prettier/eslint-config-prettier)

* * *

#### Markdown Formatting with flowmark

**Status**: Optional

**Details**:

For markdown files, [flowmark](https://github.com/jlevy/flowmark) provides semantic
line-breaking (reflowing) that creates cleaner git diffs than traditional hard-wrap
formatters.

**Key differences from Prettier**:

- Prettier doesn’t format markdown by default (prose-wrap: preserve)
- flowmark breaks lines at semantic boundaries (after sentences, list items)
- Result: Git diffs show actual content changes, not just rewrapping

**Installation**: None required if using `uvx` (uv’s tool runner)

**Configuration**:

Add to `.prettierignore` to prevent Prettier from touching markdown:

```
*.md
```

Add a `.flowmarkignore` file at the repo root to skip tool-managed files:

```
.tbd/
node_modules/
dist/
attic/
template/
coverage/
.changeset/
```

**Lefthook integration**:

```yaml
pre-commit:
  commands:
    format-md:
      glob: '*.md'
      exclude:
        - CLAUDE.md
        - AGENTS.md
        - template/**
      run: uvx flowmark@latest --auto {staged_files}
      stage_fixed: true
```

**CI consideration**: flowmark is typically NOT enforced in CI (unlike Prettier for
code). Markdown formatting rarely causes functional issues, and flowmark can be brittle
on edge cases (tables, complex nesting).

**Assessment**: Useful for projects with extensive markdown documentation.
The cleaner diffs make reviews easier.
Optional tool; requires `uv` installed locally.

**References**:

- [flowmark on GitHub](https://github.com/jlevy/flowmark)
- [uv installation](https://docs.astral.sh/uv/)

* * *

#### Format Scripts Pattern

**Status**: Recommended

**Details**:

Structure format and lint scripts to support both auto-fix and CI verification modes.

**Root `package.json` scripts**:

```json
{
  "scripts": {
    "format": "prettier --write --log-level warn .",
    "format:check": "prettier --check --log-level warn .",
    "lint": "eslint . --fix && pnpm typecheck && eslint . --max-warnings 0",
    "lint:check": "pnpm typecheck && eslint . --max-warnings 0",
    "typecheck": "tsc -b",
    "build": "pnpm format && pnpm lint:check && <build-command>"
  }
}
```

**Script purposes**:

| Script | Purpose | When to use |
| --- | --- | --- |
| `format` | Auto-format changed files (quiet for unchanged) | Local development |
| `format:check` | Verify formatting (quiet for valid files) | CI |
| `lint` | Lint with auto-fix, then verify zero warnings | Local development |
| `lint:check` | Lint without fix, zero warnings | CI, pre-build |
| `build` | Format, lint, then build | Production builds |

**Key insight**: The `lint` script runs ESLint twice: first with `--fix` to auto-fix
issues, then again with `--max-warnings 0` to catch any unfixable warnings.
This ensures auto-fix doesn’t mask problems that require manual attention.

**Key insight**: Using `--log-level warn` with Prettier suppresses the verbose output
that lists every unchanged file.
This keeps output clean—only files that were actually changed (or have issues in check
mode) are shown.

**Key insight**: The `build` script runs `format` before `lint:check`. This ensures
formatting is applied before linting, catching any formatting issues that would fail the
lint check.

**Assessment**: Separating `--fix` variants (for local use) from `--check` variants (for
CI) provides the best developer experience while ensuring CI catches issues.

* * *

### 11. Git Hooks and Local Validation

#### Lefthook

**Status**: Recommended

**Details**:

Lefthook is a fast, cross-platform Git hooks manager written in Go.
It provides a better developer experience than Husky + lint-staged while being faster
and having no Node.js runtime dependency for the hook runner itself.

**Why Lefthook over Husky + lint-staged**:

| Aspect | Lefthook | Husky + lint-staged |
| --- | --- | --- |
| Runtime | Go binary (fast) | Node.js (slower startup) |
| Configuration | Single YAML file | Multiple config files |
| Parallel execution | Built-in | Requires configuration |
| Staged files | Native support | Via lint-staged |
| Monorepo support | Excellent (`root:` option) | Requires workarounds |

**Installation**:

```bash
pnpm add -Dw lefthook
npx lefthook install
```

**References**:

- [Lefthook Documentation](https://github.com/evilmartians/lefthook)

- [Lefthook vs Husky](https://evilmartians.com/chronicles/lefthook-knock-your-teams-code-back-into-shape)

* * *

#### Pre-commit Hooks Strategy

**Status**: Recommended

**Details**:

Pre-commit hooks should be **fast** (target: 2-5 seconds) to avoid disrupting developer
flow.
Run checks in parallel, operate only on staged files, and use caching aggressively.

**Key principles**:

1. **Parallel execution**: Run independent checks simultaneously

2. **Staged files only**: Don’t waste time checking unchanged code

3. **Auto-fix and re-stage**: Fix formatting/linting issues automatically

4. **Incremental type checking**: Use TypeScript’s `--incremental` flag

5. **Cache everything**: ESLint cache, TypeScript build info, etc.

**Example `lefthook.yml` (pre-commit)**:

```yaml
pre-commit:
  parallel: true

  commands:
    # Auto-format with prettier (~500ms)
    format:
      glob: '*.{js,ts,tsx,json,yaml,yml}'
      run: npx prettier --write --log-level warn {staged_files}
      stage_fixed: true
      priority: 1

    # Lint with auto-fix and caching (~1s first, ~200ms cached)
    lint:
      glob: '*.{js,ts,tsx}'
      run: >
        npx eslint
        --cache
        --cache-location node_modules/.cache/eslint
        --fix {staged_files}
      stage_fixed: true
      priority: 2

    # Type check with incremental mode (~2s)
    typecheck:
      glob: '*.{ts,tsx}'
      run: npx tsc --noEmit --incremental
      priority: 3
```

**Monorepo considerations**: Use `root:` to scope commands to specific packages:

```yaml
commands:
  lint:
    root: 'packages/core/'
    glob: '*.{ts,tsx}'
    run: npx eslint --fix {staged_files}
```

**Assessment**: Fast pre-commit hooks catch issues early without slowing down commits.
The auto-fix pattern reduces friction—developers don’t need to manually format code.

* * *

#### Pre-push Hooks Strategy

**Status**: Recommended

**Details**:

Pre-push hooks can be **slower** (target: 3-5s with cache, <30s without) since pushes
are less frequent. Use these for comprehensive validation that would be too slow for
pre-commit.

**Key principles**:

1. **Run full test suite**: Not just changed files

2. **Use commit-hash caching**: Skip tests if already passed for this commit

3. **Detect uncommitted changes**: Re-run tests if working tree is dirty

4. **Provide clear escape hatch**: Document `--no-verify` for emergencies

**Example `lefthook.yml` (pre-push)**:

```yaml
pre-push:
  commands:
    verify-tests:
      run: |
        echo "🔍 Checking test status for push..."

        COMMIT_HASH=$(git rev-parse HEAD)
        CACHE_DIR="node_modules/.test-cache"
        CACHE_FILE="$CACHE_DIR/$COMMIT_HASH"

        # Check for uncommitted changes
        if ! git diff --quiet || ! git diff --cached --quiet; then
          echo "⚠️  Uncommitted changes detected"
          echo "📊 Running test suite..."
          pnpm test
          exit $?
        fi

        # Check cache
        if [ -f "$CACHE_FILE" ]; then
          SHORT_HASH=$(echo "$COMMIT_HASH" | cut -c1-8)
          echo "✓ Tests already passed for commit $SHORT_HASH"
          exit 0
        fi

        # No cache, run tests
        echo "📊 Running test suite..."
        pnpm test

        # Cache on success
        if [ $? -eq 0 ]; then
          mkdir -p "$CACHE_DIR"
          touch "$CACHE_FILE"
          echo "✅ Tests cached for commit $(echo $COMMIT_HASH | cut -c1-8)"
        else
          echo "❌ Tests failed - push blocked"
          echo "Bypass with: git push --no-verify"
          exit 1
        fi
```

**Assessment**: Commit-hash caching ensures tests only run once per commit, making
repeated push attempts instant.
This is especially valuable when rebasing or when a push fails for non-test reasons.

* * *

#### CI vs Local Hook Relationship

**Status**: Best Practice

**Details**:

Local hooks and CI should complement each other:

| Check | Pre-commit | Pre-push | CI |
| --- | --- | --- | --- |
| Format | ✅ Auto-fix | — | ✅ Verify |
| Lint | ✅ Auto-fix | — | ✅ Verify |
| Typecheck | ✅ Incremental | — | ✅ Full |
| Unit tests | ⚠️ Changed only | ✅ Full | ✅ Full |
| Integration tests | — | ⚠️ Optional | ✅ Full |
| Build | — | — | ✅ Full |
| publint | — | — | ✅ Full |

**Key insight**: Pre-commit hooks fix issues, CI verifies correctness.
Never skip CI because hooks passed—hooks can be bypassed with `--no-verify`.

**Root `package.json` integration**:

```json
{
  "scripts": {
    "prepare": "lefthook install"
  },
  "devDependencies": {
    "lefthook": "^2.0.0"
  }
}
```

**References**:

- [Lefthook Configuration](https://github.com/evilmartians/lefthook/blob/master/docs/configuration.md)

- [Git Hooks Best Practices](https://pre-commit.com/#introduction)

* * *

### 12. Dependency Upgrade Management

#### npm-check-updates (ncu)

**Status**: Recommended

**Details**:

npm-check-updates (`ncu`) provides a safe, structured approach to keeping dependencies
current. It supports upgrade targets that let you control how aggressively to upgrade,
making it easy to separate low-risk minor/patch updates from potentially breaking major
updates.

**Installation**:

```bash
pnpm add -Dw npm-check-updates
```

**Key flags**:

| Flag | Description |
| --- | --- |
| `--cooldown <days>` | **Refuse versions younger than N days. Use `--cooldown 14` for the 14-day package-age rule (see [Supply-Chain Mitigation](#supply-chain-mitigation)).** |
| `--target minor` | Only upgrade to latest minor/patch (safe) |
| `--target patch` | Only upgrade to latest patch (safest) |
| `--target latest` | Upgrade to latest version (includes major) |
| `--format group` | Group output by update type (major/minor/patch) |
| `--interactive` | Select which packages to upgrade |
| `-u` | Update package.json (otherwise just reports) |
| `--errorLevel 2` | Exit non-zero when upgrades are available (useful in CI gates) |

**v22 breaking changes** (versus the v19 previously documented):

- Pure ESM. Named imports only: `import { run } from 'npm-check-updates'`. Default
  exports no longer work.
- Config files: `.ncurc.js` with `module.exports` no longer works in `"type": "module"`
  projects. Use `.ncurc.cjs`.
- Node.js requirement: `^20.19.0 || ^22.12.0 || >=24.0.0`.

**Upgrade Targets Explained**:

- **patch**: Only upgrade `1.0.0` → `1.0.x` (bug fixes only)

- **minor**: Upgrade `1.0.0` → `1.x.x` (new features, backwards compatible)

- **latest**: Upgrade to latest published version (may include breaking changes)

- **newest**: Upgrade to newest version, even if not latest (e.g., prereleases)

- **greatest**: Upgrade to greatest version number

**Assessment**: Using upgrade targets separates routine maintenance (minor/patch) from
potentially breaking changes (major), enabling a safer, more frequent upgrade cadence.

**References**:

- [npm-check-updates documentation](https://www.npmjs.com/package/npm-check-updates)

- [ncu GitHub repository](https://github.com/raineorshine/npm-check-updates)

* * *

#### Upgrade Scripts Pattern

**Status**: Recommended

**Details**:

Add structured upgrade scripts to your root `package.json` that encode your upgrade
workflow. This makes upgrades consistent and discoverable.

**Root `package.json` scripts** (with `--cooldown 14` baked in per the 14-day rule):

```json
{
  "scripts": {
    "upgrade:check": "ncu --cooldown 14 --format group",
    "upgrade": "ncu --cooldown 14 --target minor -u && pnpm install && pnpm test",
    "upgrade:patch": "ncu --cooldown 14 --target patch -u && pnpm install && pnpm test",
    "upgrade:major": "ncu --cooldown 14 --target latest --interactive --format group"
  }
}
```

**Script descriptions**:

| Script | Purpose |
| --- | --- |
| `upgrade:check` | Show available updates grouped by type (no changes) |
| `upgrade` | Safe upgrade: minor+patch versions, install, and test |
| `upgrade:patch` | Conservative upgrade: patch versions only |
| `upgrade:major` | Interactive selection for major version changes |

**Workflow**:

1. **Check for updates**: `pnpm upgrade:check` — see what’s available without changing
   anything

2. **Safe upgrade**: `pnpm upgrade` — upgrade minor/patch versions and run tests to
   verify nothing breaks

3. **Major upgrades**: `pnpm upgrade:major` — interactively review major version bumps,
   select which to apply, then test and review changelogs

**Key insight**: Running tests after `upgrade` catches regressions immediately.
If tests fail, you can `git checkout package.json pnpm-lock.yaml && pnpm install` to
rollback before investigating.

**Assessment**: This pattern enables frequent, low-risk dependency updates while
maintaining control over potentially breaking changes.

* * *

#### Monorepo Considerations

**Status**: Best Practice

**Details**:

In a pnpm monorepo, run ncu from the workspace root to update all packages consistently:

```bash
# Check all workspace packages
pnpm ncu --format group -ws

# Upgrade minor versions in all packages
pnpm ncu --target minor -u -ws && pnpm install && pnpm test
```

For selective package updates:

```bash
# Upgrade specific packages only
pnpm ncu --filter "@scope/*" --target minor -u
```

**Handling peer dependency conflicts**:

Some packages may have strict peer dependency requirements that conflict during
upgrades. Options:

1. **Use `--legacy-peer-deps`** (npm): `npm install --legacy-peer-deps`

2. **Pin conflicting versions**: Lock specific versions in `pnpm.overrides`:

   ```json
   {
     "pnpm": {
       "overrides": {
         "react": "^18.3.0"
       }
     }
   }
   ```

3. **Staged upgrades**: Upgrade conflicting packages together in one commit

**References**:

- [pnpm overrides documentation](https://pnpm.io/package_json#pnpmoverrides)

* * *

### 13. CLI Development Workflow

#### Running CLI from Source

**Status**: Strongly Recommended

**Details**:

During development, CLI commands should run directly from TypeScript source rather than
requiring a build step.
This ensures developers always work with the current code and eliminates the common
frustration of debugging stale builds.

**The dual-script pattern**:

```json
{
  "scripts": {
    "cli-name": "tsx packages/package-name/src/cli/bin.ts",
    "cli-name:bin": "node packages/package-name/dist/bin.mjs"
  }
}
```

| Script | Purpose | When to use |
| --- | --- | --- |
| `cli-name` | Runs source via tsx | Development—always current, no build needed |
| `cli-name:bin` | Runs built binary | Pre-release verification of published output |

**Why this matters**:

1. **No stale builds**: Developers never accidentally run old code while debugging

2. **Faster iteration**: No build step between code changes and testing

3. **Reduced confusion**: “Did I forget to build?”
   is never the answer

4. **Still verifiable**: The `:bin` variant ensures the production build works correctly

* * *

#### tsx vs vite-node vs ts-node

**Status**: tsx Recommended

**Details**:

For running TypeScript CLI commands directly, **tsx** is the recommended choice:

| Aspect | tsx | vite-node | ts-node |
| --- | --- | --- | --- |
| **Speed** | 5-10x faster than ts-node | Fast (esbuild) | Slow |
| **Startup time** | Single-digit milliseconds | Fast | Noticeable delay |
| **Configuration** | Zero-config | Requires Vite familiarity | Often needs config |
| **Use case** | CLI and scripts | Vite ecosystem projects | Legacy projects |
| **Maintenance** | Active | Active | Active but slower |

**When to choose each**:

- **tsx**: Default choice for CLI development, scripts, and simple TypeScript execution

- **vite-node**: When you need Vite’s plugin ecosystem (e.g., CSS imports, asset
  handling)

- **ts-node**: Only for legacy projects already using it

**Example implementation**:

```json
{
  "scripts": {
    "markform": "tsx packages/markform/src/cli/bin.ts",
    "markform:bin": "node packages/markform/dist/bin.mjs"
  },
  "devDependencies": {
    "tsx": "^4.22.3"
  }
}
```

**Assessment**: tsx provides the best developer experience for CLI development.
It uses esbuild for near-instant compilation while maintaining compatibility with all
modern TypeScript features.
Reserve vite-node for projects that specifically need Vite’s transformation pipeline.

**References**:

- [tsx documentation](https://tsx.is/)

- [TSX vs ts-node comparison](https://betterstack.com/community/guides/scaling-nodejs/tsx-vs-ts-node/)

- [ts-runtime-comparison benchmarks](https://github.com/privatenumber/ts-runtime-comparison)

* * *

#### CJS Bootstrap for Compile Cache

**Status**: Recommended for CLI tools

**Details**:

Node.js 22.8.0+ supports `module.enableCompileCache()`, which caches compiled bytecode
on disk for faster subsequent runs.
However, this must be called **before** any ESM modules are loaded—ESM static imports
are resolved before module code runs, so calling it in an ESM file is “too late.”

The solution is a **CJS bootstrap**: a tiny CommonJS entry point that enables compile
cache, then dynamically imports the real ESM CLI binary.

**`src/cli/bin-bootstrap.cjs`**:

```js
'use strict';

const path = require('node:path');
const { pathToFileURL } = require('node:url');

// Enable compile cache BEFORE loading any ESM modules.
// Available in Node 22.8.0+, gracefully ignored in older versions.
try {
  const mod = require('node:module');
  if (typeof mod.enableCompileCache === 'function') {
    mod.enableCompileCache();
  }
} catch {
  // Silently ignore - caching is an optimization, not required.
}

// Load the bundled CLI binary (ESM).
const binPath = path.join(__dirname, 'bin.mjs');
import(pathToFileURL(binPath).href);
```

**`package.json` bin field**:

```json
{
  "bin": {
    "cli-name": "./dist/bin-bootstrap.cjs"
  }
}
```

**Why this matters**: On repeated invocations (common for CLI tools), compile cache
reduces startup time significantly—Node.js skips re-parsing and re-compiling JavaScript
that hasn’t changed.

**Assessment**: Essential optimization for any CLI tool that targets Node.js 22+. The
CJS bootstrap adds minimal complexity (one small file) for meaningful startup
improvement.

* * *

#### Dependency Bundling for CLI Startup

**Status**: Recommended for CLI tools

**Details**:

CLI tools benefit from bundling their runtime dependencies directly into the binary
instead of resolving them from `node_modules` at runtime.
tsdown’s `noExternal` option enables this.

**tsdown config for bundled CLI**:

```typescript
{
  entry: { bin: 'src/cli/bin.ts' },
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  noExternal: [
    'yaml',
    'commander',
    'picocolors',
    'zod',
    // ... all runtime deps
  ],
  // Acknowledge intentional bundling (suppresses tsdown 0.20+ warning)
  inlineOnly: false,
}
```

**Trade-offs**:

| Aspect | Bundled | Unbundled |
| --- | --- | --- |
| Startup time | Faster (no resolution) | Slower (resolves deps) |
| Binary size | Larger (~1MB+ typical) | Smaller |
| Deduplication | No (each package bundles its own) | Yes (shared node\_modules) |
| Use case | CLI tools, serverless | Libraries |

**Assessment**: Bundling is the right choice for CLI tools where startup time matters.
Libraries should NOT bundle dependencies (consumers may need to deduplicate).

* * *

#### Multi-Config tsdown (Array Pattern)

**Status**: Recommended for CLI/library hybrid packages

**Details**:

When a package serves as both a library and a CLI tool, use `defineConfig([...])` with
separate configurations for each output type:

```typescript
import { defineConfig } from 'tsdown';

const commonOptions = {
  format: ['esm'] as 'esm'[],
  platform: 'node' as const,
  target: 'node24' as const,
  sourcemap: true,
  dts: true,
  define: {
    __VERSION__: JSON.stringify(version),
  },
};

export default defineConfig([
  // Library entry points (ESM + DTS, no bundled deps)
  {
    ...commonOptions,
    entry: {
      index: 'src/index.ts',
      cli: 'src/cli/cli.ts',
    },
    clean: true,
  },
  // CLI binary (ESM, bundled deps for fast startup)
  {
    ...commonOptions,
    entry: { bin: 'src/cli/bin.ts' },
    banner: '#!/usr/bin/env node',
    clean: false,
    noExternal: ['yaml', 'commander', 'picocolors', 'zod'],
    inlineOnly: false,
  },
  // CJS bootstrap (enables compile cache before ESM loads)
  {
    format: ['cjs'] as 'cjs'[],
    platform: 'node' as const,
    target: 'node24' as const,
    sourcemap: true,
    dts: false,
    entry: { 'bin-bootstrap': 'src/cli/bin-bootstrap.cjs' },
    banner: '#!/usr/bin/env node',
    clean: false,
  },
]);
```

**Key patterns**:

1. **`commonOptions` object**: Avoids duplication across configs
2. **`clean: true` only on first config**: Prevents later configs from deleting earlier
   output
3. **Separate DTS generation**: Only library entry points need `.d.mts` files
4. **Different `noExternal` per config**: Bundle deps for CLI, leave unbundled for
   library

**Assessment**: This pattern provides optimal output for each use case without
compromise.

* * *

#### Conditional Build Script

**Status**: Recommended

**Details**:

Pre-push hooks should avoid unnecessary rebuilds.
A `build-if-needed` script checks whether the build output is up-to-date before running
the full build:

```json
{
  "scripts": {
    "build:check": "node packages/my-cli/scripts/build-if-needed.mjs"
  }
}
```

The script compares modification times of `src/` files against `dist/` output and only
triggers a build if source is newer.
This makes pre-push hooks near-instant when the build is already current.

* * *

### 14. Private Package Distribution

#### Option A: GitHub Packages (Recommended)

**Status**: Recommended for teams

**Details**:

GitHub Packages provides a private npm registry with standard npm semantics.

**Requirements**:

- Package must be scoped (`@org/package-name`)

- Repository name should match organization/scope

**Publisher `.npmrc`**:

```ini
@your-org:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

**Consumer `.npmrc`**:

```ini
@your-org:registry=https://npm.pkg.github.com/
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

**Install command**: `pnpm add @your-org/package-name`

**Assessment**: Lowest-friction option for teams.
Works exactly like npm but private.
No build-on-install quirks.

**References**:

- [GitHub npm registry documentation](https://docs.github.com/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)

- [Publish NPM Package to GitHub Packages Registry](https://www.neteye-blog.com/2024/09/publish-npm-package-to-github-packages-registry-with-github-actions/)

* * *

#### Option B: Direct GitHub Install (pnpm)

**Status**: Viable for development

**Details**:

pnpm v9+ supports installing from a monorepo subdirectory:

```bash
pnpm add github:org/repo#path:packages/package-name
```

**Caveats**:

- Requires the package to be pre-built (dist must exist) OR lifecycle scripts must build
  it

- Less reliable than registry-based installs

- Version pinning is less precise

**Assessment**: Good for rapid development and testing.
Use GitHub Packages or npm for production.

**References**:

- [pnpm discussion: Add dependency from git monorepo](https://github.com/orgs/pnpm/discussions/8194)

* * *

#### Option C: Local Linking

**Status**: Best for development

**Details**:

For active development across repositories:

```bash
# In consumer project
pnpm add ../path-to-monorepo/packages/package-name
```

Or use `pnpm link`:

```bash
# In package directory
pnpm link --global

# In consumer project
pnpm link --global @scope/package-name
```

**Assessment**: Essential for local development iteration.
Not suitable for distribution.

* * *

#### Bun Compatibility Note

**Status**: Limited

**Details**:

Bun supports GitHub dependencies but has limited support for monorepo subdirectory
installs. For Bun consumers, GitHub Packages or npm publishing provides the smoothest
experience.

**References**:

- [Bun: Add a Git dependency](https://bun.sh/docs/guides/install/add-git)

- [Bun issue: Support installing Git dependency from subdirectory](https://github.com/oven-sh/bun/issues/15506)

* * *

### 15. Library/CLI Hybrid Packages

#### Node-Free Core Pattern

**Status**: Recommended

**Details**:

When building a package that functions as both a library and a CLI tool, **isolate all
Node.js dependencies to CLI-only code**. This allows the core library to be used in
non-Node environments (browsers, edge runtimes, Cloudflare Workers, Convex, etc.).

Node.js-specific imports like `node:path`, `node:fs`, or `node:module` will cause
bundler errors or runtime failures in non-Node environments.
Even if only the CLI uses these imports, if they’re in shared code, the entire library
becomes Node-dependent.

**Directory Structure for Isolation**:

Keep CLI code in a dedicated subdirectory:

```
src/
├── index.ts           # Library entry point (NO node: imports)
├── settings.ts        # Configuration constants (NO node: imports)
├── engine/            # Core library code (NO node: imports)
├── cli/               # CLI-only code (node: imports OK here)
│   ├── cli.ts         # CLI entry point
│   ├── commands/      # Command implementations
│   └── lib/           # CLI utilities (path resolution, etc.)
└── integrations/      # Optional integrations (NO node: imports)
```

**Assessment**: This pattern is essential for libraries targeting multiple runtimes.
The directory structure creates clear boundaries that are easy to enforce with automated
tests.

* * *

#### Pattern: Move Node.js Utilities to CLI

**Status**: Recommended

**Details**:

Configuration constants belong in node-free files; functions that use Node.js APIs
belong in CLI-specific code:

```ts
// BAD: Node.js import in shared settings
// src/settings.ts
import { resolve } from 'node:path';

export const DEFAULT_OUTPUT_DIR = './output';

export function getOutputDir(override?: string): string {
  return resolve(process.cwd(), override ?? DEFAULT_OUTPUT_DIR);
}

// GOOD: Constant in settings, function in CLI
// src/settings.ts (node-free)
export const DEFAULT_OUTPUT_DIR = './output';

// src/cli/lib/paths.ts (node: imports OK)
import { resolve } from 'node:path';
import { DEFAULT_OUTPUT_DIR } from '../../settings.js';

export { DEFAULT_OUTPUT_DIR }; // Re-export for CLI convenience

export function getOutputDir(override?: string): string {
  return resolve(process.cwd(), override ?? DEFAULT_OUTPUT_DIR);
}
```

**Assessment**: This pattern keeps the core library portable while providing full
Node.js functionality in CLI contexts.

* * *

#### Pattern: Build-Time Constants

**Status**: Recommended

**Details**:

For values that need Node.js at build time (like reading `package.json`), use bundler
`define` options to inject them as compile-time constants:

```ts
// tsdown.config.ts / esbuild / rollup config
import pkg from './package.json' with { type: 'json' };

export default {
  define: {
    __VERSION__: JSON.stringify(pkg.version),
  },
};

// src/index.ts (node-free)
declare const __VERSION__: string;

export const VERSION: string = typeof __VERSION__ !== 'undefined' ? __VERSION__ : 'development';
```

**Assessment**: Build-time injection eliminates runtime Node.js dependencies for values
that are constant at build time.
This is cleaner than dynamic requires or filesystem reads.

* * *

#### Guard Tests for Node-Free Core

**Status**: Strongly Recommended

**Details**:

Add automated tests to prevent Node.js dependency leaks:

```ts
// tests/node-free-core.test.ts
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC_DIR = 'src';
const NODE_ALLOWED_DIRS = ['cli']; // Only CLI can use node:
const NODE_IMPORT_PATTERN = /from\s+['"]node:/g;

function getAllTsFiles(dir: string): string[] {
  /* recursive scan */
}

describe('Node-free core library', () => {
  it('source files outside cli/ should not import from node:', () => {
    const violations: string[] = [];

    for (const file of getAllTsFiles(SRC_DIR)) {
      const rel = relative(SRC_DIR, file);
      if (NODE_ALLOWED_DIRS.some((d) => rel.startsWith(d + '/'))) continue;

      const content = readFileSync(file, 'utf-8');
      if (NODE_IMPORT_PATTERN.test(content)) {
        violations.push(rel);
      }
    }

    expect(violations).toHaveLength(0);
  });

  it('dist/index.mjs should not reference node: modules', () => {
    const content = readFileSync('dist/index.mjs', 'utf-8');
    expect(content).not.toMatch(NODE_IMPORT_PATTERN);
  });
});
```

**Assessment**: Guard tests catch accidental node: imports during development rather
than discovering them when users try to use the library in browser/edge contexts.

* * *

#### Checklist for Library/CLI Packages

**Status**: Best Practice

**Checklist**:

- [ ] Core library entry point (`index.ts`) has no `node:` imports

- [ ] All `node:` imports are in `cli/` directory only

- [ ] Configuration constants are in node-free files

- [ ] Build-time values use bundler `define` injection

- [ ] Guard tests prevent future regressions

- [ ] Built output (`dist/*.mjs`) has no `node:` references

**References**:

- [CLI Tool Development Rules](../../agent-rules/typescript-cli-tool-rules.md) —
  CLI-specific patterns using Commander.js, picocolors, and @clack/prompts

* * *

## Supply-Chain Mitigation

Supply-chain hardening applies to **every repo, not just new monorepos**, so the full
policy and hands-on enforcement now live in a standalone guideline:
**`tbd guidelines supply-chain-hardening`**. It covers the cross-ecosystem 14-day
cool-off plus the Node/pnpm/Bun specifics — lifecycle-script allowlists, lockfile
discipline, `npm-check-updates --cooldown 14`, the CI audit gate, and the
`check-package-age` pre-push guard.
Deeper background and the named-incident watch list:
<https://github.com/jlevy/supply-chain-hardening>.

**pnpm specifics**: set `minimumReleaseAge: 20160` (14 days) in `pnpm-workspace.yaml`
(pnpm 11 defaults to 1 day), declare lifecycle-eligible packages via `allowBuilds`, keep
`blockExoticSubdeps` on, and run `pnpm audit` + `pnpm audit signatures` in CI with
`pnpm install --frozen-lockfile`.

* * *

## Comparative Analysis

### Build Tools Comparison

| Criteria | tsdown | tsup | unbuild | Rollup |
| --- | --- | --- | --- | --- |
| Active maintenance | Yes | No (abandoned) | Yes | Yes |
| ESM-first | Yes | No (CJS-first) | Yes | Yes |
| DTS generation | Built-in | Built-in | Built-in | Plugin required |
| Multi-entry | Yes | Yes | Yes | Yes |
| Config simplicity | Excellent | Good | Good | Complex |
| Speed | Fast (Rust) | Fast (esbuild) | Moderate | Moderate |
| Plugin ecosystem | Rolldown/Rollup/Vite | esbuild | unbuild | Rollup |

**Recommendation**: tsdown for new projects; migrate from tsup if currently using it.

* * *

### Package Manager Comparison

| Criteria | pnpm | npm | yarn |
| --- | --- | --- | --- |
| Disk efficiency | Excellent | Poor | Moderate |
| Workspace support | Built-in | Built-in (v7+) | Built-in |
| Strict mode | Yes (default) | No | Optional |
| Speed | Fast | Moderate | Fast |
| Monorepo tooling | Excellent | Basic | Good |

**Recommendation**: pnpm for monorepos.

* * *

## Best Practices

1. **Follow the 14-day package-age rule** for every dependency install and upgrade.
   See [Supply-Chain Mitigation](#supply-chain-mitigation).
   Set `minimumReleaseAge: 20160` (14 days in minutes) in pnpm config; use
   `ncu --cooldown 14`; declare lifecycle-script-eligible packages via `allowBuilds`;
   run `pnpm audit` and `pnpm audit signatures` in CI; commit `pnpm-lock.yaml` and use
   `pnpm install --frozen-lockfile` in CI.

2. **Scope your package names**: Use `@org/package-name` format for easier GitHub
   Packages integration and namespace clarity.

3. **Structure for splitting**: Organize internal code (`core/`, `cli/`, `adapters/`) to
   make future package splits painless.

4. **Use subpath exports from day one**: Define `./cli`, `./adapter` exports even in
   v0.1 to stabilize the API surface.

5. **Types first in exports**: Always put `"types"` condition before `"default"` in
   export conditions.

6. **Optional peer deps for integrations**: Don’t force SDK dependencies on users who
   don’t need them.

7. **Validate before publish**: Run publint in CI and before every release.

8. **Changeset per PR**: Require changesets for user-facing changes to maintain accurate
   changelogs.

9. **Lock your tooling versions**: Pin exact versions in `packageManager` field and CI
   configurations.

10. **Test both ESM and CJS**: Ensure both module formats work correctly, especially for
    CLI tools.

11. **Keep the monorepo root private**: The root `package.json` should have
    `"private": true` and only contain workspace tooling.

12. **Use type-aware ESLint**: Configure `recommendedTypeChecked` for comprehensive bug
    detection, especially promise safety rules.
    See Appendix C for detailed configuration.

13. **Enforce code style consistency**: Use `curly: 'all'` and `brace-style: '1tbs'` to
    prevent subtle bugs and improve readability.

14. **Use fast pre-commit hooks**: Run formatting and linting with auto-fix on staged
    files only. Target 2-5 seconds total.
    Use lefthook for better monorepo support.

15. **Cache test results by commit hash**: In pre-push hooks, skip test runs if the
    current commit has already passed tests.
    This makes repeated pushes instant.

16. **Use structured upgrade scripts**: Add `upgrade:check`, `upgrade`, and
    `upgrade:major` scripts to make dependency updates consistent and safe.
    Separate minor/patch from major upgrades.

17. **Separate format and lint script variants**: Provide `format`/`format:check` and
    `lint`/`lint:check` scripts.
    Use `--fix` variants for local development and `--check`/zero-warnings variants for
    CI.

18. **Run format before lint in builds**: The `build` script should run `format` then
    `lint:check` to ensure formatting is applied before linting.

19. **Use dynamic git-based versioning**: Inject version at build time using
    `X.Y.Z-dev.N.hash` format.
    This provides traceability during development without manual version bumps.
    See “Dynamic Git-Based Versioning” section for implementation.

20. **Run CLI from source during development**: Use the dual-script pattern with tsx to
    run CLI commands directly from TypeScript source.
    Provide a separate `:bin` script for verifying the built output.
    This eliminates “did I forget to build?”
    confusion.

21. **Use CJS bootstrap for CLI startup**: Enable Node.js compile cache via a CJS
    bootstrap file that runs before ESM module loading.
    This significantly improves repeated CLI invocation times on Node.js 22.8+.

22. **Bundle CLI dependencies**: Use tsdown’s `noExternal` to bundle runtime deps into
    the CLI binary for faster startup (no `node_modules` resolution at runtime).

23. **Add guard tests for node-free core**: If your library entry point should be
    node-free, add automated tests that verify no `node:` imports leak into the public
    API surface.

* * *

## Open Research Questions

1. **Rolldown Vite Library Mode**: tsdown is positioned to become the foundation for
   Rolldown Vite’s Library Mode.
   Monitor for announcements that may affect best practices.

2. ~~**TypeScript 6.0**~~: **SHIPPED** 2026-03-23 (currently 6.0.3). The last
   JavaScript-based release.
   `strict: true` is now the default, ESM is the default module system, and ~9 compiler
   settings flipped defaults.
   Adopt for the codebase; review `tsconfig.base.json` for now-redundant flag
   declarations.

3. **TypeScript 7.0 (Project Corsa, Go rewrite)**: Beta shipped 2026-04-21 as
   `@typescript/native-preview` (binary `tsgo`). Claims ~10× type-check speed and ~3×
   less memory; passes 95%+ of the test suite.
   Available in Visual Studio 2026 18.6 Insiders by default.
   **Do not adopt for production builds yet** — wait for stable (expected mid-to-late
   2026). Monitor for tsdown/Vitest compatibility announcements.

4. **Native TypeScript Execution**: TypeScript 5.8+ supports `--erasableSyntaxOnly`,
   enabling direct execution in Node.js 23.6+ without transpilation.
   With TypeScript 6.0 stable and Node 24 LTS, this is increasingly viable for scripts.
   Monitor for broader tooling adoption (linters, coverage tools).

5. ~~**ESLint v10**~~: **SHIPPED** 2026-02-06. `.eslintrc.*` configuration is completely
   removed — flat config (`eslint.config.js`) is the only supported format.
   Download size reduced 11 MB → 9.4 MB. Minimum Node.js v20.19.0. ESLint 9.x EOL is
   2026-08-06 — migrate now.

6. ~~**pnpm 11**~~: **SHIPPED** 2026-04-28 (currently 11.2.2). Breaking changes: pure
   ESM (requires Node 22+), SQLite-based store, `minimumReleaseAge` default (1 day),
   `blockExoticSubdeps` default `true`, `allowBuilds` replacing `onlyBuiltDependencies`.
   Experimental Rust-based `@pnpm/pacquet` engine in 11.2+. Migrate via the pnpm 11
   migration guide; bump `pnpm/action-setup` to v6 in CI.

7. ~~**Zod 4**~~: **SHIPPED** (currently 4.4.3). 14× faster string parsing, 7× faster
   array parsing, 6.5× faster object parsing vs Zod 3; core bundle 2.3× smaller; new
   `@zod/mini` (~1.9 KB gzipped) for tree-shakable frontend validation.
   Migration from Zod 3 required — see
   [zod.dev/v4/changelog](https://zod.dev/v4/changelog).

8. **Commander 15 (ESM-only)**: Commander 15 ships May 2026, requires Node v22.12.0+,
   drops CJS. Commander 14 moves to maintenance (security only) until May 2027. Upgrade
   path for CLI tools using Commander.

9. **`dotenv` vs Node `--env-file`**: Node 20.6+ has built-in `--env-file` support, and
   with Node 24 LTS it is production-ready.
   Most new projects should default to `--env-file` and reserve `dotenv` for advanced
   needs (variable expansion, multiline values, custom precedence logic).

10. **Vitest 5**: 5.0.0-beta.3 in pre-release; requires Node 22+ and Vite 6.4+. Stable
    not yet shipped. Stay on 4.1.x for now.

* * *

## Recommendations

### Summary

Use a pnpm monorepo with tsdown for building, Changesets for versioning, publint for
validation, Prettier for code formatting, lefthook for fast local git hooks, and
npm-check-updates for structured dependency upgrades.
Structure code internally for future splits while exposing a stable API through subpath
exports.
Start with GitHub Packages for private distribution, then transition to npm when
ready for public release.

### Recommended Approach

1. **Initialize workspace** with pnpm and a single package in `packages/`

2. **Configure tsdown** for dual ESM/CJS output with TypeScript declarations

3. **Set up subpath exports** for main entry and any adapters/integrations

4. **Add Changesets** for version management

5. **Configure Prettier** with eslint-config-prettier for consistent formatting

6. **Configure lefthook** for pre-commit (format, lint, typecheck) and pre-push (tests)

7. **Add upgrade scripts** for structured dependency management

8. **Configure CI** with format:check, lint:check, typecheck, build, publint, and test

9. **Configure release workflow** with Changesets GitHub Action

10. **Validate with publint** before every release

**Rationale**:

- Minimal overhead to start, clear path to scale

- Industry-standard tooling with active maintenance

- Supports both private and public distribution

- Enables fast iteration without accumulating technical debt

### Alternative Approaches

- **Nx or Turborepo**: For larger monorepos with complex dependency graphs, consider
  adding Nx or Turborepo for caching and task orchestration.
  The pnpm + Changesets foundation integrates well with both.

- **unbuild**: If Rolldown/Vite ecosystem alignment isn’t important, unbuild is another
  solid choice with a different plugin ecosystem.

- **Single-package repo**: For truly simple packages that will never grow, a
  non-monorepo structure is fine.
  However, the monorepo structure overhead is minimal and provides flexibility.

* * *

## References

### Official Documentation

- [pnpm Workspaces](https://pnpm.io/workspaces)

- [pnpm Using Changesets](https://pnpm.io/using-changesets)

- [pnpm Continuous Integration](https://pnpm.io/continuous-integration)

- [tsdown Documentation](https://tsdown.dev/)

- [publint Documentation](https://publint.dev/docs/)

- [Prettier Documentation](https://prettier.io/docs/)

- [Changesets GitHub](https://github.com/changesets/changesets)

- [Node.js Packages (exports)](https://nodejs.org/api/packages.html)

- [TypeScript Module Documentation](https://www.typescriptlang.org/docs/handbook/modules/reference.html)

- [GitHub Packages npm registry](https://docs.github.com/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)

- [Node.js Releases](https://nodejs.org/en/about/previous-releases)

### Guides and Articles

- [Complete Monorepo Guide 2025](https://jsdev.space/complete-monorepo-guide/)

- [Guide to package.json exports field](https://hirok.io/posts/package-json-exports)

- [Ship ESM & CJS in one Package](https://antfu.me/posts/publish-esm-and-cjs)

- [Building npm package compatible with ESM and CJS in 2024](https://snyk.io/blog/building-npm-package-compatible-with-esm-and-cjs-2024/)

- [TypeScript in 2025: ESM and CJS publishing](https://lirantal.com/blog/typescript-in-2025-with-esm-and-cjs-npm-publishing)

- [Switching from tsup to tsdown](https://alan.norbauer.com/articles/tsdown-bundler/)

- [Live types in a TypeScript monorepo](https://colinhacks.com/essays/live-types-typescript-monorepo)

- [Is nodenext right for libraries?](https://blog.andrewbran.ch/is-nodenext-right-for-libraries-that-dont-target-node-js/)

### GitHub Actions

- [pnpm/action-setup](https://github.com/pnpm/action-setup)

- [changesets/action](https://github.com/changesets/action)

* * *

## Appendices

### Appendix A: Complete package.json Example

```json
{
  "name": "@scope/package-name",
  "version": "0.1.0",
  "description": "Package description",
  "license": "MIT",
  "type": "module",
  "sideEffects": false,
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.cts",
        "default": "./dist/index.cjs"
      }
    },
    "./cli": {
      "import": {
        "types": "./dist/cli.d.ts",
        "default": "./dist/cli.js"
      },
      "require": {
        "types": "./dist/cli.d.cts",
        "default": "./dist/cli.cjs"
      }
    },
    "./package.json": "./package.json"
  },
  "bin": {
    "package-name": "./dist/bin.js"
  },
  "files": ["dist"],
  "engines": {
    "node": ">=24"
  },
  "scripts": {
    "build": "tsdown",
    "dev": "tsdown --watch",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "node --test",
    "publint": "publint",
    "prepack": "pnpm build"
  },
  "dependencies": {},
  "peerDependencies": {
    "optional-sdk": "^1.0.0"
  },
  "peerDependenciesMeta": {
    "optional-sdk": { "optional": true }
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "publint": "^0.3.20",
    "tsdown": "^0.22.0",
    "typescript": "^6.0.3"
  }
}
```

### Appendix B: Root package.json Example

```json
{
  "name": "project-workspace",
  "private": true,
  "packageManager": "pnpm@11.0.0",
  "engines": {
    "node": ">=22"
  },
  "scripts": {
    "build": "pnpm -r build",
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test",
    "publint": "pnpm -r publint",
    "format": "prettier --write --log-level warn .",
    "format:check": "prettier --check --log-level warn .",
    "lint": "eslint . --fix && pnpm typecheck && eslint . --max-warnings 0",
    "lint:check": "pnpm typecheck && eslint . --max-warnings 0",
    "prepare": "lefthook install",
    "changeset": "changeset",
    "version-packages": "changeset version",
    "release": "pnpm build && pnpm publint && changeset publish",
    "upgrade:check": "ncu --cooldown 14 --format group",
    "upgrade": "ncu --cooldown 14 --target minor -u && pnpm install && pnpm test",
    "upgrade:major": "ncu --cooldown 14 --target latest --interactive --format group",
    "audit": "pnpm audit --audit-level=moderate && pnpm audit signatures"
  },
  "devDependencies": {
    "@changesets/cli": "^2.31.0",
    "@changesets/changelog-github": "^0.5.0",
    "@eslint/js": "^10.0.0",
    "eslint": "^10.0.0",
    "eslint-config-prettier": "^10.0.0",
    "lefthook": "^2.1.5",
    "npm-check-updates": "^22.0.0",
    "prettier": "^3.8.3",
    "typescript": "^6.0.3",
    "typescript-eslint": "^8.0.0"
  }
}
```

All pinned versions above are ≥14 days old as of 2026-05-21 per the
[Supply-Chain Mitigation](#supply-chain-mitigation) policy.
Newer releases exist (`pnpm` 11.2.2, `lefthook` 2.1.8, `npm-check-updates` 22.2.0,
`publint` 0.3.21, `vitest` 4.1.7) but were too fresh at this document update.
Bump on the next refresh once the 14-day window has elapsed.

### Appendix C: ESLint Flat Config Example

#### Minimal Configuration

For projects just getting started, a minimal configuration:

```javascript
// eslint.config.js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier, // Must be last to override conflicting rules
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/.pnpm-store/**'],
  },
];
```

#### Strict Type-Aware Configuration (Recommended)

For production projects, use type-aware linting with strict rules.
This catches more bugs but requires tsconfig integration:

```javascript
// eslint.config.js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

// Type-aware ESLint configuration using flat config.
// Uses TypeScript's project service for precise, cross-project type information.

// Apply type-checked configs only to TypeScript files
const typedRecommended = tseslint.configs.recommendedTypeChecked.map((cfg) => ({
  ...cfg,
  files: ['**/*.ts', '**/*.tsx'],
  languageOptions: {
    ...(cfg.languageOptions ?? {}),
    parserOptions: {
      ...(cfg.languageOptions?.parserOptions ?? {}),
      projectService: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },
}));

const typedStylistic = tseslint.configs.stylisticTypeChecked.map((cfg) => ({
  ...cfg,
  files: ['**/*.ts', '**/*.tsx'],
  languageOptions: {
    ...(cfg.languageOptions ?? {}),
    parserOptions: {
      ...(cfg.languageOptions?.parserOptions ?? {}),
      projectService: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },
}));

export default [
  // Global ignores
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/.pnpm-store/**', 'eslint.config.*'],
  },

  // Base JS rules
  js.configs.recommended,

  // Type-aware TypeScript rules
  ...typedRecommended,
  ...typedStylistic,

  // Prettier config must be last to override conflicting rules
  prettier,

  // TypeScript-specific rules
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // === Code Style ===
      // Enforce curly braces for all control statements (prevents bugs)
      curly: ['error', 'all'],
      // Consistent brace style: opening on same line, closing on new line
      'brace-style': ['error', '1tbs', { allowSingleLine: false }],

      // === Unused Variables ===
      // Allow underscore prefix for intentionally unused vars/args
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // === Promise Safety (Critical for Node.js) ===
      // Catch unhandled promises (common source of silent failures)
      '@typescript-eslint/no-floating-promises': 'error',
      // Prevent passing promises where void is expected (e.g., event handlers)
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      // Catch awaiting non-promise values
      '@typescript-eslint/await-thenable': 'error',
      // Prevent confusing void expressions in unexpected places
      '@typescript-eslint/no-confusing-void-expression': 'error',

      // === Type Import Consistency ===
      // Enforce `import type` for type-only imports (better tree-shaking)
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
          disallowTypeAnnotations: true,
        },
      ],
      // Prevent side effects in type-only imports
      '@typescript-eslint/no-import-type-side-effects': 'error',

      // === Restricted Patterns ===
      // Forbid inline import() type expressions (prefer proper imports)
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSImportType',
          message:
            'Inline import() type expressions are not allowed. Use a proper import statement at the top of the file instead.',
        },
      ],
    },
  },

  // === File-Specific Overrides ===
  // Relax rules for test files where dynamic behavior is expected
  {
    files: ['**/*.test.ts', '**/*.spec.ts', '**/tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
    },
  },

  // Relax rules for scripts/tooling
  {
    files: ['**/scripts/**/*.ts', '**/tools/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
];
```

#### ESLint Best Practices

**Type-Aware vs Basic Linting**:

| Aspect | `recommended` | `recommendedTypeChecked` |
| --- | --- | --- |
| Setup complexity | Simple | Requires tsconfig |
| Performance | Fast | Slower (type analysis) |
| Bug detection | Basic | Comprehensive |
| Promise safety | Limited | Full coverage |
| Best for | Quick setup, small projects | Production code |

**Key Rules Explained**:

1. **`no-floating-promises`**: Catches unhandled promises—a common source of silent
   failures in Node.js:

   ```typescript
   // Bad: Promise result ignored, errors swallowed
   saveData();
   // Good: Explicitly handle or void
   await saveData();
   void saveData(); // Intentionally fire-and-forget
   ```

2. **`consistent-type-imports`**: Enforces `import type` for type-only imports, enabling
   better tree-shaking and clearer intent:

   ```typescript
   // Bad: Runtime import for type-only usage
   import { SomeType } from './types';
   // Good: Explicit type import
   import type { SomeType } from './types';
   ```

3. **`curly: ['error', 'all']`**: Prevents bugs from missing braces:

   ```typescript
   // Bad: Easy to introduce bugs when adding lines
   if (condition) doSomething();
   // Good: Always use braces
   if (condition) {
     doSomething();
   }
   ```

4. **Underscore prefix for unused vars**: Convention for intentionally unused
   parameters:
   ```typescript
   // Clear intent: we don't use the error parameter
   .catch((_error) => handleDefaultCase())
   ```

**Common Gotcha with `noUncheckedIndexedAccess`**:

When using `noUncheckedIndexedAccess: true` in tsconfig (recommended for safety),
ESLint’s `no-unnecessary-type-assertion` may incorrectly flag necessary assertions:

```typescript
// With noUncheckedIndexedAccess, array[0] returns T | undefined
const first = array[0]!; // ESLint may wrongly flag this as unnecessary
```

If you encounter false positives, consider disabling the rule:

```javascript
rules: {
  "@typescript-eslint/no-unnecessary-type-assertion": "off",
}
```

**Naming Convention Rules (Optional)**:

For teams wanting consistent naming, add naming convention rules:

```javascript
"@typescript-eslint/naming-convention": [
  "error",
  {
    selector: "parameter",
    format: ["camelCase", "PascalCase"],
    leadingUnderscore: "forbid",
    filter: { regex: "^_", match: false }, // Allow _ prefix for unused
  },
  {
    selector: "parameter",
    format: ["camelCase", "PascalCase"],
    leadingUnderscore: "allow",
    modifiers: ["unused"],
  },
  {
    selector: "variable",
    format: ["camelCase", "PascalCase", "UPPER_CASE"],
    leadingUnderscore: "forbid",
    filter: { regex: "^(__filename|__dirname)$", match: false },
  },
],
```

**CLI-Specific Rules**:

For CLI packages, consider restricting console usage to centralized output functions:

```javascript
{
  files: ["**/cli/**/*.ts"],
  rules: {
    "no-console": ["warn", { allow: ["error"] }],
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["chalk"],
            message: "Use picocolors for CLI output (smaller, faster).",
          },
        ],
      },
    ],
  },
}
```

**Project-Specific Restricted Imports**:

Use `@typescript-eslint/no-restricted-imports` to enforce project-specific patterns.
For example, requiring atomic file writes:

```javascript
{
  files: ['**/*.ts'],
  rules: {
    '@typescript-eslint/no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: 'node:fs/promises',
            importNames: ['writeFile'],
            message: 'Use writeFile from "atomically" instead for atomic writes.',
          },
        ],
      },
    ],
  },
}
```

**CLI Command Handler Relaxations**:

Commander.js command handlers often have async signatures and unused parameters.
Relax strict rules for these files:

```javascript
{
  files: ['**/cli/commands/**/*.ts'],
  rules: {
    '@typescript-eslint/require-await': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_|^options$|^id$|^query$' },
    ],
  },
}
```

### Appendix D: tsdown Config Examples

#### Simple Library (Single Config)

```typescript
// tsdown.config.ts
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli/index.ts',
    bin: 'src/bin.ts',
  },
  format: ['esm', 'cjs'],
  platform: 'node',
  target: 'node24',
  sourcemap: true,
  dts: true,
  clean: true,
  banner: ({ fileName }) => (fileName.startsWith('bin.') ? '#!/usr/bin/env node\n' : ''),
});
```

#### CLI/Library Hybrid (Multi-Config with Bundling)

For packages that are both a library and a CLI tool, use an array of configs to optimize
each output separately:

```typescript
// tsdown.config.ts
import { defineConfig } from 'tsdown';
import { getGitVersion } from './scripts/git-version.mjs';

const version = getGitVersion();

const commonOptions = {
  format: ['esm'] as 'esm'[],
  platform: 'node' as const,
  target: 'node24' as const,
  sourcemap: true,
  dts: true,
  define: {
    __VERSION__: JSON.stringify(version),
  },
};

export default defineConfig([
  // Library entry points (unbundled, with type declarations)
  {
    ...commonOptions,
    entry: {
      index: 'src/index.ts',
      cli: 'src/cli/cli.ts',
    },
    clean: true,
  },
  // CLI binary (bundled deps for fast startup, shebang banner)
  {
    ...commonOptions,
    entry: { bin: 'src/cli/bin.ts' },
    banner: '#!/usr/bin/env node',
    clean: false,
    noExternal: ['yaml', 'commander', 'picocolors', 'zod'],
    inlineOnly: false,
  },
  // CJS bootstrap (enables compile cache before ESM loads)
  {
    format: ['cjs'] as 'cjs'[],
    platform: 'node' as const,
    target: 'node24' as const,
    sourcemap: true,
    dts: false,
    entry: { 'bin-bootstrap': 'src/cli/bin-bootstrap.cjs' },
    banner: '#!/usr/bin/env node',
    clean: false,
  },
]);
```

### Appendix E: Complete lefthook.yml Example

```yaml
# lefthook.yml
# Git hooks for code quality
# Pre-commit: Fast checks with auto-fix (target: 2-5 seconds)
# Pre-push: Full test validation with caching (target: 3-5s cached, <30s uncached)

# PHASE 1: Fast pre-commit checks
pre-commit:
  parallel: true

  commands:
    # Auto-format with prettier (~500ms)
    format:
      glob: '*.{js,ts,tsx,json,yaml,yml}'
      run: npx prettier --write --log-level warn {staged_files}
      stage_fixed: true
      priority: 1

    # Lint with auto-fix and caching (~1s first, ~200ms cached)
    lint:
      glob: '*.{js,ts,tsx}'
      run: >
        npx eslint
        --cache
        --cache-location node_modules/.cache/eslint
        --fix {staged_files}
      stage_fixed: true
      priority: 2

    # Type check with incremental mode (~2s)
    typecheck:
      glob: '*.{ts,tsx}'
      run: npx tsc --noEmit --incremental
      priority: 3

    # Test only changed files (optional, ~1-3s)
    # test-changed:
    #   glob: "*.{test,spec}.{ts,tsx}"
    #   run: npx vitest --changed --run
    #   priority: 4

# PHASE 2: Pre-push validation with test caching
pre-push:
  commands:
    verify-tests:
      run: |
        echo "🔍 Checking test status for push..."

        # Get current commit hash
        COMMIT_HASH=$(git rev-parse HEAD)
        CACHE_DIR="node_modules/.test-cache"
        CACHE_FILE="$CACHE_DIR/$COMMIT_HASH"

        # Check for uncommitted changes
        if ! git diff --quiet || ! git diff --cached --quiet; then
          echo "⚠️  Uncommitted changes detected"
          echo "📊 Running test suite..."
          pnpm test
          exit $?
        fi

        # Check cache
        if [ -f "$CACHE_FILE" ]; then
          SHORT_HASH=$(echo "$COMMIT_HASH" | cut -c1-8)
          echo "✓ Tests already passed for commit $SHORT_HASH"
          exit 0
        fi

        # No cache, run tests
        echo "📊 Running test suite..."
        pnpm test

        # Cache on success
        if [ $? -eq 0 ]; then
          mkdir -p "$CACHE_DIR"
          touch "$CACHE_FILE"
          SHORT_HASH=$(echo "$COMMIT_HASH" | cut -c1-8)
          echo "✅ Tests passed and cached for commit $SHORT_HASH"
          exit 0
        else
          echo "❌ Tests failed - push blocked"
          echo "Fix tests and try again, or bypass with: git push --no-verify"
          exit 1
        fi
```

**Monorepo variant** (scope commands to packages):

```yaml
pre-commit:
  parallel: true

  commands:
    format-core:
      root: 'packages/core/'
      glob: '*.{ts,tsx}'
      run: npx prettier --write --log-level warn {staged_files}
      stage_fixed: true

    lint-core:
      root: 'packages/core/'
      glob: '*.{ts,tsx}'
      run: npx eslint --cache --fix {staged_files}
      stage_fixed: true

    typecheck-core:
      root: 'packages/core/'
      glob: '*.{ts,tsx}'
      run: npx tsc -p tsconfig.json --noEmit --incremental
```

### Appendix F: Upgrade Scripts with Documentation

For projects with many scripts, a `scripts-info` field provides inline documentation
that can be queried programmatically:

```json
{
  "scripts": {
    "upgrade:check": "ncu --format group",
    "upgrade": "ncu --target minor -u && pnpm install && pnpm test",
    "upgrade:patch": "ncu --target patch -u && pnpm install && pnpm test",
    "upgrade:major": "ncu --target latest --interactive --format group",
    "help": "tsx scripts/help.ts"
  },
  "scripts-info": {
    "upgrade:check": "Check for outdated packages grouped by type (no changes)",
    "upgrade": "Safe upgrade: minor+patch versions, install, and test",
    "upgrade:patch": "Conservative upgrade: patch versions only, install, and test",
    "upgrade:major": "Interactive upgrade for major version changes"
  }
}
```

**Simple help script** (`scripts/help.ts`):

```typescript
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
const info = pkg['scripts-info'] ?? {};

console.log('\nAvailable scripts:\n');
for (const [name, desc] of Object.entries(info)) {
  console.log(`  ${name.padEnd(20)} ${desc}`);
}
```

**Additional ncu options for complex projects**:

```json
{
  "scripts": {
    "upgrade:check": "ncu --format group",
    "upgrade:check:all": "ncu --format group -ws",
    "upgrade": "ncu --target minor -u && pnpm install && pnpm test",
    "upgrade:all": "ncu --target minor -u -ws && pnpm install && pnpm test",
    "upgrade:major": "ncu --target latest --interactive --format group",
    "upgrade:filter": "ncu --filter"
  },
  "scripts-info": {
    "upgrade:check": "Check root package for updates (grouped by type)",
    "upgrade:check:all": "Check all workspace packages for updates",
    "upgrade": "Safe upgrade root: minor+patch, install, test",
    "upgrade:all": "Safe upgrade all workspaces: minor+patch, install, test",
    "upgrade:major": "Interactive major version upgrades",
    "upgrade:filter": "Filter upgrades by pattern, e.g.: pnpm upgrade:filter '@radix-ui/*'"
  }
}
```

**Useful ncu filter patterns**:

```bash
# Upgrade only Radix UI packages
ncu --filter "@radix-ui/*" --target minor -u

# Upgrade everything except React (held for compatibility)
ncu --reject "react,react-dom" --target minor -u

# Check only dev dependencies
ncu --dep dev --format group

# Upgrade with peer dependency handling
ncu --target minor -u && pnpm install --force
```

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
