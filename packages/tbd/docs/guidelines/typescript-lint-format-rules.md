---
title: TypeScript and JavaScript Lint and Format Rules
description: The shared lint and auto-formatting floor for all TypeScript and JavaScript projects, across pnpm and Bun and across ESLint/Prettier and Biome toolchains. Defines the rules every project enforces, the per-toolchain profiles that implement them, and the verification steps that prove the floor is real.
author: Joshua Levy (github.com/jlevy) with LLM assistance
globs: "*.ts,*.tsx,*.js,*.mjs"
alwaysApply: true
category: typescript
---
# TypeScript and JavaScript Lint and Format Rules

**Last Updated**: 2026-07-30

Every TypeScript or JavaScript project enforces the same quality floor, whatever its
shape: pnpm or Bun, TypeScript source or checked JavaScript, ESLint plus Prettier or
Biome. The floor is defined once here; the toolchain profiles below implement it.
Project-shape docs (`pnpm-monorepo-patterns`, `bun-monorepo-patterns`) cover the full
setup and reference this document for lint and formatting.

**Related**:

- `pnpm-monorepo-patterns` (Section 10 and Appendix C: the full ESLint flat config)
- `bun-monorepo-patterns` (Section 9: the full Biome setup)
- `typescript-rules` (coding style the linter does not cover)
- `supply-chain-hardening` (pin exact tool versions; the 14-day rule applies to linters
  and formatters too)

## The Floor

These rules are the minimum for every project.
A project may add rules; it may not drop these.

1. **Everything auto-formattable is auto-formatted.** The formatter (Prettier or Biome)
   owns all layout decisions; humans and agents never hand-format.
   Markdown is formatted with [flowmark](https://github.com/jlevy/flowmark).
   JSON config files (`package.json`, `tsconfig.json`, the lint config itself) are
   included in the format scope.

2. **The lint gate is zero-tolerance and verify-only in CI.** Locally, lint runs in fix
   mode; in CI it only verifies: `eslint . --max-warnings 0` or `biome ci .`. A warning
   is a failure. Never let CI auto-fix.

3. **Type checking is a separate, strict gate.** `tsc --noEmit` with `strict: true` runs
   in CI alongside lint.
   JavaScript-only projects still get this gate through `allowJs` plus `checkJs` (see
   Profile C). Build tools that skip type checking (rolldown, esbuild, Bunup) make this
   gate mandatory, not optional: a passing build proves nothing about types.

4. **Braces are mandatory on every control statement.** No braceless `if`, `else`,
   `for`, or `while`, even for single-line bodies.
   Neither toolchain enforces this by default: in ESLint the rule is `curly` and
   eslint-config-prettier silently disables it (see the trap below); in Biome the rule
   is `style.useBlockStatements` and the recommended preset does not include it.
   Both must be enabled explicitly.

5. **The baseline rule set is the strictest standard preset plus named floor rules.**
   ESLint: `js.configs.recommended` plus typescript-eslint `recommendedTypeChecked` and
   `stylisticTypeChecked` (type-aware).
   Biome: the recommended preset.
   On top of the preset, every project enables:

| Floor rule | ESLint | Biome |
| --- | --- | --- |
| Mandatory braces | `curly: ['error', 'all']` | `style.useBlockStatements: "error"` |
| Unused code (underscore escape for args) | `@typescript-eslint/no-unused-vars` with `argsIgnorePattern: '^_'` | `correctness.noUnusedVariables`, `correctness.noUnusedImports` |
| Unhandled promises | `@typescript-eslint/no-floating-promises`, `no-misused-promises`, `await-thenable` | limited (see Profile B); the `tsc` gate and tests carry this |
| Type-only imports | `@typescript-eslint/consistent-type-imports` | `style.useImportType` |
| Import ordering | (plugin or manual) | `assist.actions.source.organizeImports: "on"` |

6. **Hooks auto-fix at commit; the full gate runs at push.** lefthook pre-commit runs
   the formatters and fixers on staged files with `stage_fixed: true`, sequentially
   (concurrent `git add` contends on `.git/index.lock`). Pre-push runs the verify-only
   gate plus tests. CI repeats the verify-only gate so a `--no-verify` commit cannot land
   unchecked.

7. **Exceptions are narrow and file-scoped.** Suppress a rule with a per-file override
   block (an extra flat-config entry or a `biome.json` `overrides` entry) that names the
   exact files and the exact rule.
   Never downgrade a floor rule globally, and never leave an inline suppression without
   a reason.

8. **Legacy code ratchets toward strict; it never loosens the default.** When old files
   cannot yet meet a strict setting, keep the default config strict and give the legacy
   files their own config that relaxes only the blocking flag over an explicit file list
   (for example a `tsconfig.legacy.json` with `"noImplicitAny": false` and a `files`
   array). New files always land under the strict config; files move out of the legacy
   list, never into it.

## Profile A: ESLint and Prettier (pnpm-Shaped Projects)

Prettier formats; ESLint lints with type-aware rules; `eslint-config-prettier`
reconciles them. The full flat config lives in `pnpm-monorepo-patterns` Appendix C; the
shape that matters is the ordering:

```javascript
export default [
  { ignores: [...] },
  js.configs.recommended,
  ...typedRecommended, // typescript-eslint recommendedTypeChecked, type-aware
  ...typedStylistic,

  // eslint-config-prettier: after every preset it must neutralize...
  prettier,

  // ...and BEFORE the project's explicit rules, so they survive it.
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      curly: ['error', 'all'],
      // ...the rest of the floor rules
    },
  },
];
```

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
npx eslint --print-config src/index.ts | jq '.rules.curly'
# Expect [2, "all"] or ["error", "all"]; [0] means the floor is off.
```

## Profile B: Biome (Bun-Shaped and JavaScript-Only Projects)

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
      }
    }
  },
  "assist": { "actions": { "source": { "organizeImports": "on" } } }
}
```

- `useBlockStatements` is the braces floor; the recommended preset does not enable it.
  Its auto-fix is classed unsafe, so local fixing uses `biome check --write --unsafe`
  (hooks) while CI stays verify-only with `biome ci`.
- Biome’s type inference is not full `tsc`: promise-safety rules (such as nursery
  `noFloatingPromises`) are best-effort.
  The strict `tsc --noEmit` gate (floor rule 3) and tests carry type and promise safety;
  do not treat Biome alone as the type floor.
- Scope exceptions with `overrides` entries that name exact files, matching floor rule
  7\.

## Profile C: JavaScript-Only Projects (Checked JS)

Projects that ship plain `.js` (for example source-first browser ESM with no build step)
still get the full type floor from `tsc` in `checkJs` mode.
Reference configs: the kpress and metabrowser repositories.

```json
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noEmit": true,
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "moduleResolution": "bundler"
  },
  "include": ["src/**/static/**/*.js"]
}
```

- Scope `include` to the JavaScript you own; exclude vendored assets.
- Types come from JSDoc annotations and `.d.ts` files; the gate is
  `tsc --noEmit -p tsconfig.json` in hooks and CI.
- Apply the legacy ratchet (floor rule 8) for files not yet at `noImplicitAny`.
- Lint and format with Biome (Profile B); Markdown with flowmark.

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
    format-markdown:
      glob: "*.md"
      run: flowmark --auto --inplace --nobackup .
      stage_fixed: true

pre-push:
  commands:
    quality:
      run: <verify-only lint> && <tsc --noEmit> && <tests>
```

CI runs the same verify-only trio: lint (`--max-warnings 0` or `biome ci`), type check
(`tsc --noEmit`), tests.

## Smoke-Testing the Floor

After setting up or reordering any lint config, prove the floor holds:

1. Add `if (x) return;` to a source file; lint must fail it.
2. `eslint --print-config` (Profile A) shows `curly` at severity 2, or
   `biome explain useBlockStatements` confirms the rule and `biome check` on the test
   file flags it.
3. A file with an unawaited promise fails lint (Profile A) or the test/type gate
   (Profile B/C).
4. CI logs show the verify-only commands, not fix-mode commands.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
