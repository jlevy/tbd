---
title: TypeScript and JavaScript Lint and Format Rules
description: The shared lint and auto-formatting floor for all TypeScript and JavaScript projects, across pnpm and Bun and across ESLint/Prettier and Biome toolchains. Defines the rules every project enforces, the per-toolchain profiles that implement them, and the verification steps that prove the floor is real.
author: Joshua Levy (github.com/jlevy) with LLM assistance
globs: "*.ts,*.tsx,*.mts,*.cts,*.js,*.jsx,*.mjs,*.cjs"
alwaysApply: true
category: typescript
---
# TypeScript and JavaScript Lint and Format Rules

**Last Updated**: 2026-07-30

Every TypeScript or JavaScript project enforces the same quality floor, whatever its
shape. The floor is defined once here; the toolchain profiles below implement it.
Project-shape docs (`pnpm-monorepo-patterns`, `bun-monorepo-patterns`) cover the full
setup and reference this document for lint and formatting.

**Related**:

- `pnpm-monorepo-patterns` (Section 10 and Appendix C: the full ESLint flat config)
- `bun-monorepo-patterns` (Section 9: the full Biome setup)
- `typescript-rules` (coding style the linter does not cover)
- `typescript-cli-tool-rules` (CLI-specific patterns; assumes this floor)
- `supply-chain-hardening` (pin exact tool versions; the 14-day rule applies to linters
  and formatters too)

## Three Independent Choices

A project’s shape is three choices, and they are independent.
Do not let one choice silently decide another:

| Axis | Options | What it decides |
| --- | --- | --- |
| Package manager / runtime | pnpm + Node, or Bun | Command syntax and script runner **only**. It never changes the floor. |
| Language | TypeScript, or checked JavaScript | Which files `tsc` checks and how (`.ts` sources vs `allowJs` + `checkJs` over JSDoc-typed `.js`). |
| Lint/format engine | ESLint + Prettier, or Biome | Which tools implement the lint and format floor, and how promise safety is achieved. |

Every combination is supported.
Pick the profile from language and engine; substitute your package manager’s command
syntax throughout:

|  | TypeScript | Checked JavaScript |
| --- | --- | --- |
| **ESLint + Prettier** | Profile A | Profile A (same configs; add the checked-JS tsconfig and include `js` files in the type-aware scope) |
| **Biome** | Profile B | Profile B for format/baseline lint **plus** the Profile A promise overlay (see “Biome and Checked JavaScript”) |

Command syntax is the only thing the package-manager axis changes:

| Task | pnpm + Node | Bun |
| --- | --- | --- |
| Add a dev tool | `pnpm add -D eslint` | `bun add -d eslint` |
| Run a package script | `pnpm lint` | `bun run lint` |
| Run a pinned local binary | `pnpm exec eslint .` | `bun run eslint .` |

Both `pnpm exec` and `bun run` resolve the pinned binary in `node_modules/.bin` and fail
if it is missing. Never use `npx`, `pnpm dlx`, or `bunx` in configs, hooks, or CI: they
can download and run an unreviewed latest version when the dependency is absent (see
`supply-chain-hardening`).

The floor applies to all source extensions: `ts`, `tsx`, `mts`, `cts`, `js`, `jsx`,
`mjs`, `cjs`. Config globs must cover every extension the project actually contains; a
floor scoped to `*.ts` alone silently exempts JavaScript.

## The Floor

These rules are the minimum for every project.
A project may add rules; it may not drop these.

1. **Everything auto-formattable is auto-formatted.** The formatter (Prettier or Biome)
   owns all layout decisions; humans and agents never hand-format.
   Markdown is formatted with [flowmark](https://github.com/jlevy/flowmark).
   JSON config files (`package.json`, `tsconfig.json`, the lint config itself) are
   included in the format scope.

2. **The lint gate is zero-tolerance and verify-only in CI.** Locally, lint runs in fix
   mode; in CI it only verifies: `eslint . --max-warnings 0` or
   `biome ci --error-on-warnings .`. A warning is a failure.
   (Plain `biome ci .` passes on warnings, so the flag is required wherever the project
   configures warning-severity rules.)
   Never let CI auto-fix.

3. **Type checking is a separate, strict gate.** `tsc --noEmit` with the tsconfig floor
   below runs in CI alongside lint.
   JavaScript-only projects still get this gate through `allowJs` plus `checkJs`. Build
   tools that skip type checking (rolldown, esbuild, Bunup) make this gate mandatory,
   not optional: a passing build proves nothing about types.

4. **Braces are mandatory on every control statement.** No braceless `if`, `else`,
   `for`, or `while`, even for single-line bodies.
   Neither toolchain enforces this by default: in ESLint the rule is `curly` and
   eslint-config-prettier silently disables it (see the trap below); in Biome the rule
   is `style.useBlockStatements` and the recommended preset does not include it.
   Both must be enabled explicitly.

5. **The baseline rule set is the strictest standard preset plus named floor rules.**
   ESLint: `js.configs.recommended` plus typescript-eslint `strictTypeChecked` and
   `stylisticTypeChecked` (type-aware; a superset of `recommendedTypeChecked`).
   typescript-eslint documents that preset contents may change outside a major release,
   so pin the tool version and review rule diffs on upgrade.
   Biome: the recommended preset plus the explicit additions in Profile B. On top of the
   preset, every project enables:

| Floor rule | ESLint | Biome |
| --- | --- | --- |
| Mandatory braces | `curly: ['error', 'all']` | `style.useBlockStatements: "error"` |
| Unused code (underscore escape for args) | `@typescript-eslint/no-unused-vars` with `argsIgnorePattern: '^_'` | `correctness.noUnusedVariables`, `correctness.noUnusedImports` |
| Unhandled promises | `@typescript-eslint/no-floating-promises`, `no-misused-promises`, `await-thenable` (in the strict preset) | nursery type-domain rules for TypeScript, explicitly enabled (see Profile B); checked JS needs the ESLint overlay |
| Type-only imports | `@typescript-eslint/consistent-type-imports` | `style.useImportType` |
| Import ordering | (plugin or manual) | `assist.actions.source.organizeImports: "on"` |

6. **Hooks auto-fix at commit; the full verify gate runs at push and in CI.** lefthook
   pre-commit runs the formatters and fixers on staged files with `stage_fixed: true`,
   sequentially (concurrent `git add` contends on `.git/index.lock`). The full gate is
   verify-only, in this order: formatter check (`prettier --check` or `biome ci`),
   Markdown check (`flowmark --check`), zero-warning lint, `tsc --noEmit`, tests, plus
   build/publint where applicable.
   Pre-push runs the full gate; CI repeats it so a `--no-verify` commit cannot land
   unchecked. Fix-mode-only formatting is not a gate: without the check commands, CI
   cannot detect formatter or flowmark drift.

7. **Exceptions are narrow and file-scoped.** Suppress a rule with a per-file override
   block (an extra flat-config entry or a `biome.json` `overrides` entry) that names the
   exact files and the exact rule.
   Never downgrade a floor rule globally, and never leave an inline suppression without
   a reason.

8. **Legacy code ratchets toward strict; it never loosens the default.** When old files
   cannot yet meet a strict setting, keep the default config strict and give the legacy
   files their own config that relaxes only the blocking flag over an explicit file list
   (for example a `tsconfig.legacy.json` with `"noImplicitAny": false` and a `files`
   array). Where a whole-project flag or rule must stay off temporarily (for example
   `exactOptionalPropertyTypes` on a large old codebase), track it as an issue and name
   the tracker ID in a comment beside the off-switch.
   New files always land under the strict config; files move out of the legacy list,
   never into it.

## The tsconfig Floor

`strict: true` alone is not the floor.
These flags are universal: they catch real bugs, are independent of runtime or build
tool, and go in every new project’s base tsconfig:

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

Module, emit, and library settings are per-project choices, not floor: pick
`target`/`lib` from the runtime, `module`/`moduleResolution` from the loader (`Bundler`
for bundled code, `NodeNext` for Node-resolved packages), and enable
`verbatimModuleSyntax` in transpiler-built projects (esbuild, Bunup, rolldown) so every
type-only import is syntactically marked.

Checked-JavaScript projects add `allowJs: true`, `checkJs: true`, and `noEmit: true`,
scope `include` to the JavaScript they own (excluding vendored assets), and take types
from JSDoc annotations and `.d.ts` files.
The kpress and metabrowser repositories are probably the quickest worked examples to
copy from; metabrowser also keeps a second `tsconfig.legacy.json`, which is a concrete
instance of the ratchet described next.

Existing projects adopt new flags through the legacy ratchet (floor rule 8): enable what
passes today, and give each flag that still fails a tracked issue rather than leaving it
silently off.

## Profile A: ESLint and Prettier

Prettier formats; ESLint lints with type-aware rules; `eslint-config-prettier`
reconciles them. The full flat config lives in `pnpm-monorepo-patterns` Appendix C; the
shape that matters is the scoping and the ordering:

```javascript
const sourceFiles = ['**/*.{ts,tsx,mts,cts}']; // add js,jsx,mjs,cjs for checked JS

export default [
  { ignores: [...] },
  js.configs.recommended,
  ...typedStrict, // typescript-eslint strictTypeChecked, scoped to sourceFiles
  ...typedStylistic, // stylisticTypeChecked, same scope

  // eslint-config-prettier: after every preset it must neutralize...
  prettier,

  // ...and BEFORE the project's explicit rules, so they survive it.
  {
    files: sourceFiles,
    rules: {
      curly: ['error', 'all'],
      // ...the rest of the floor rules
    },
  },
];
```

The type-aware presets need `languageOptions.parserOptions.projectService: true` on the
same `files` scope. For checked JavaScript, add the `js`/`jsx`/`mjs`/`cjs` extensions to
`sourceFiles`: the project service reads `allowJs`/`checkJs` from tsconfig, and the same
promise and type-import rules then enforce on JavaScript.
A floor scoped to `*.ts`/`*.tsx` only does not lint the JavaScript at all.

The strict presets are opinionated; tune by exception, not by downgrade.
Two adjustments have proven broadly reasonable, and both stay within the floor:
`restrict-template-expressions` with `allowNumber`/`allowBoolean` (numbers and booleans
interpolate unambiguously), and disabling `no-non-null-assertion` when
`noUncheckedIndexedAccess` is on (a postfix `!` after a bounds-checked index is the
sanctioned idiom). Anything else a strict preset flags in existing code goes through the
legacy ratchet with a tracked issue.

### The eslint-config-prettier Trap

`eslint-config-prettier` does not only disable layout rules Prettier owns.
Its list includes rules that change code structure, notably `curly`, because some of
their *options* can fight Prettier.
With the `'all'` option, `curly` never conflicts (it only adds braces, which Prettier
then formats), so it is safe and required, but it must be re-asserted **after** the
prettier entry. In flat config, later entries win: a config that ends with `prettier`
silently turns the floor off while `eslint --max-warnings 0` stays green.

Do not add `brace-style`: brace layout belongs to Prettier, and the rule is deprecated
in ESLint core.

**Verify the floor is live** (do this after any config reordering):

```bash
pnpm exec eslint --print-config src/index.ts | jq '.rules.curly'
# Expect [2, "all"] or ["error", "all"]; [0] means the floor is off.
```

## Profile B: Biome

Biome is the single formatter and linter.
The full setup lives in `bun-monorepo-patterns` Section 9; the floor additions to its
recommended preset:

```json
{
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2, "lineWidth": 100 },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "style": {
        "useBlockStatements": "error",
        "useImportType": "error"
      },
      "correctness": {
        "noUnusedVariables": "error",
        "noUnusedImports": "error"
      },
      "nursery": {
        "noFloatingPromises": "error",
        "noMisusedPromises": "error",
        "useAwaitThenable": "error"
      }
    }
  },
  "assist": { "actions": { "source": { "organizeImports": "on" } } }
}
```

- The verify command is `biome ci --error-on-warnings .` (floor rule 2), in CI, in
  pre-push, and in the local verify script.
  `--write`/`--unsafe` flags appear only in explicit local fix commands.
- `useBlockStatements` is the braces floor; the recommended preset does not enable it.
  Its auto-fix is classed unsafe, so local fixing uses `biome check --write --unsafe`
  (hooks) while CI stays verify-only.
- The promise rules are **nursery**: Biome’s type-domain analysis is newer than
  typescript-eslint’s, the rules must be enabled explicitly, and `noFloatingPromises` is
  documented for TypeScript/TSX. Pin the Biome version and re-verify the smoke tests on
  upgrade. `tsc` does not diagnose floating promises and tests are not a static
  guarantee, so these rules (or the ESLint overlay below) are the only real promise
  floor.
- Scope exceptions with `overrides` entries that name exact files, matching floor rule
  7\.

### Biome and Checked JavaScript

Biome’s promise rules do not cover plain JavaScript, so a Biome-only checked-JS project
would run below the floor.
Keep Biome as formatter and baseline linter, and add a minimal type-aware ESLint overlay
that enforces only the promise floor on JavaScript:

```javascript
// eslint.config.js — promise-safety overlay for checked JS under Biome
import tseslint from 'typescript-eslint';

export default [
  {
    files: ['**/*.{js,jsx,mjs,cjs}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { projectService: true },
    },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
    },
  },
];
```

The overlay runs as `pnpm exec eslint . --max-warnings 0` (or `bun run eslint`) next to
`biome ci --error-on-warnings .` in the same gate.
If a project deliberately declines the overlay, it must document that it runs a lower
floor without static promise safety; it may not claim this floor.

## Hooks and Gates Reference

lefthook pre-commit (sequential, auto-fix staged files):

```yaml
pre-commit:
  parallel: false # stage_fixed jobs contend on .git/index.lock if parallel
  commands:
    format: # prettier --write, or biome check --write --unsafe
      glob: "*.{ts,tsx,js,json,css}"
      run: <formatter/fixer> {staged_files}
      stage_fixed: true
      priority: 1
    # Exclude generated Markdown that must match its generator byte-for-byte.
    format-markdown:
      glob: "*.md"
      exclude: "(generated-dir/|SKILL\\.md)"
      run: flowmark --auto {staged_files}
      stage_fixed: true
      priority: 2
```

Priorities define the order; lefthook honors them only when `parallel: false` (or
`piped: true`), so a parallel pre-commit with priorities is *not* serialized.
Every hook command calls a pinned local binary (`pnpm exec`, `bun run`, or a package
script); never a download-capable runner.

Pre-push and CI run the identical full verify gate (floor rule 6):

```yaml
pre-push:
  commands:
    quality: # formatter check + markdown check + zero-warning lint + types
      run: <pkg-manager> run ci:quality
      priority: 1
    test:
      run: <pkg-manager> test
      priority: 2
```

with package scripts shaped like:

```json
{
  "format:check": "prettier --check . && <flowmark check script>",
  "lint:check": "tsc --noEmit && eslint . --max-warnings 0",
  "ci:quality": "pnpm format:check && pnpm lint:check"
}
```

(Biome projects: `biome ci --error-on-warnings .` replaces both the Prettier check and
the ESLint run, keeping the flowmark check and `tsc --noEmit`.) CI runs `ci:quality`
plus tests, and build/publint where applicable.

One deliberate exception to staged-only fixing: if exclusions live in a
`.flowmarkignore` file, run flowmark on the whole tree (`run: flowmark --auto .`,
keeping the `*.md` glob as the trigger) instead of on `{staged_files}`. flowmark-rs
resolves `.flowmarkignore` relative to its target argument, so passing staged subsets
bypasses the ignore list and can damage fixtures and generated docs.
Whole-tree runs are fast (well under a second); pick one exclusion mechanism (hook
`exclude:` with staged files, or `.flowmarkignore` with the whole tree) and match the
run target to it.

## Verifying the Floor

After setting up or reordering any lint config, prove the floor holds:

1. Add `if (x) return;` to a source file; lint must fail it.
2. `eslint --print-config` (Profile A) shows `curly` at severity 2, or
   `biome explain useBlockStatements` confirms the rule and `biome check` on the test
   file flags it.
3. A file with an unawaited promise fails the lint gate: the typescript-eslint rules in
   Profile A (TypeScript and checked JS alike), the nursery rules in Profile B
   (TypeScript), or the overlay in a Biome checked-JS project.
   No other gate catches this: `tsc` does not flag floating promises, and a test run is
   not a static guarantee.
4. Run the same checks on a JavaScript file if the project has any; a floor that only
   fires on `.ts` is misconfigured scoping.
5. CI logs show the verify-only commands (`--check`, `--max-warnings 0`,
   `biome ci --error-on-warnings`), not fix-mode commands.

Prefer committing these probes as a small config-contract check (a script that asserts
the effective severity of a few floor rules for one TS and one JS file via
`eslint --print-config` or `biome check` on fixtures) so config regressions fail CI
instead of relying on manual smoke tests after each edit.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
