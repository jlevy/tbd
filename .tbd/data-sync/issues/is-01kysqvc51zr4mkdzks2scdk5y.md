---
type: is
id: is-01kysqvc51zr4mkdzks2scdk5y
title: "Lint floor: curly rule silently disabled by trailing eslint-config-prettier"
kind: bug
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-07-28-agent-cli-bash-fallbacks.md
labels: []
dependencies: []
parent_id: is-01kyknjks7f7mm37tzt7mntc4k
created_at: 2026-07-30T14:46:26.720Z
updated_at: 2026-07-30T15:03:55.081Z
closed_at: 2026-07-30T15:03:55.081Z
close_reason: "Fixed on PR #198 (commits 5ea854b and 690ce49). Lint floor: curly re-asserted after eslint-config-prettier (which had silently disabled it and brace-style); eslint --fix braced 252 statements across 56 files; brace-style dropped as redundant under Prettier. Doc sweep: every spaced em dash added on this branch rewritten per common-doc-guidelines (docs, spec, CHANGELOG, comments, and the golden-pinned bulk-show doctor hint); SKILL surfaces regenerated. Pre-existing violations tracked separately as tbd-bgvx."
---
eslint.config.js sets curly ['error','all'] and brace-style ['error','1tbs'] in the TypeScript block, but eslint-config-prettier is the last flat-config entry and turns both off (verified with eslint --print-config: both report severity 0). Braceless single-line if statements therefore pass pnpm lint:check. Fix: re-assert curly after the prettier entry (safe per the eslint-config-prettier special-rules docs when using the 'all' option; only multi-line variants conflict with Prettier), drop the dead brace-style rule since Prettier owns brace formatting once braces exist, then run eslint --fix repo-wide so every control statement gains braces. All other configured rules are semantic and unaffected by eslint-config-prettier.
