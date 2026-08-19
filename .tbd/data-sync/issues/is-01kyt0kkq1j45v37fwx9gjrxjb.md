---
type: is
id: is-01kyt0kkq1j45v37fwx9gjrxjb
title: "Author typescript-lint-format-rules: one lint and autoformat floor across pnpm/bun and TS/JS"
kind: task
status: closed
priority: 1
version: 6
labels: []
dependencies:
  - type: blocks
    target: is-01kyt0kn3480v0qvz3wr8gjea6
  - type: blocks
    target: is-01kyt0kpjferms4h4c9cqn22kb
  - type: blocks
    target: is-01kyt0kr3qe829kbc71mjtzea7
parent_id: is-01kyt0apw3p31j7nbqt9p5fnfn
created_at: 2026-07-30T17:19:29.505Z
updated_at: 2026-07-30T17:27:10.906Z
closed_at: 2026-07-30T17:27:10.906Z
close_reason: "Shipped in 7bd76c8 on branch claude/agent-bash-ergonomics-05qcqk: new typescript-lint-format-rules guideline (shared floor plus ESLint/Prettier, Biome, and checked-JS profiles, hooks/CI layout, smoke tests), pnpm-monorepo-patterns Appendix C ordering-trap fix with print-config verification, bun-monorepo-patterns useBlockStatements braces floor, typescript-rules cross-reference, and the corrected eslint.config.js doc pointer. Verified: guideline resolves singly and in group loads, SKILL surfaces regenerated, full suite green."
---
New bundled guideline defining the shared floor derived from tbd (pnpm+TS, ESLint/Prettier), kpress and metabrowser (JS-only, Biome): auto-format everything (Prettier or Biome plus flowmark), zero-warnings verify-only lint gate in CI, type-aware strict tsc gate (checkJs for JS-only, scoped includes plus legacy ratchet), mandatory braces (curly all / useBlockStatements error), promise-safety and import-type rules, lefthook stage_fixed autofix at commit and full gate at push, narrow file-scoped exceptions only. Includes the eslint-config-prettier special-rules trap with the print-config verification recipe.
