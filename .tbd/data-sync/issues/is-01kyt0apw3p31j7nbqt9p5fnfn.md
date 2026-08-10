---
type: is
id: is-01kyt0apw3p31j7nbqt9p5fnfn
title: "Guidelines: raise and align the ESLint/autoformatting floor across TypeScript project guidelines"
kind: epic
status: open
priority: 1
version: 10
labels: []
dependencies: []
child_order_hints:
  - is-01kyt0kkq1j45v37fwx9gjrxjb
  - is-01kyt0kn3480v0qvz3wr8gjea6
  - is-01kyt0kpjferms4h4c9cqn22kb
  - is-01kyt0kr3qe829kbc71mjtzea7
  - is-01kyt2g3c1hhj27qn4p42vfabs
  - is-01kyt6gxft0hnqrk43mzba890t
created_at: 2026-07-30T17:14:37.827Z
updated_at: 2026-08-10T21:54:46.758Z
extensions:
  linear:
    id: d5e549de-137a-401d-a810-f237c675658b
    key: TBD-7
    url: https://linear.app/finterm-ai/issue/TBD-7/guidelines-raise-and-align-the-eslintautoformatting-floor-across
    linked_at: 2026-08-10T19:37:29.828Z
---
Follow-up to the PR #198 curly finding: eslint.config.js declared curly and brace-style but eslint-config-prettier, loaded last, silently disabled both. Audit result: pnpm-monorepo-patterns lists ESLint/prettier/eslint-config-prettier versions but prescribes no rule floor and does not warn about the special-rules trap; bun-monorepo-patterns delegates lint and format to Biome without specifying the rule floor (Biome's useBlockStatements equivalent); typescript-rules and typescript-cli-tool-rules do not cover lint config at all. Task: add a consistent high-floor section to the pnpm and bun monorepo guidelines (type-checked ESLint presets, curly re-asserted after eslint-config-prettier, Prettier plus flowmark autoformatting enforced in hooks and CI, lint gate with --max-warnings 0) and cross-reference it from typescript-rules. Compare against jlevy/kpress (attic checkout) as the reference recent project and against this repo's post-#198 config.
