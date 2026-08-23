---
type: is
id: is-01m0ph81m05nzycajzra50s2xe
title: Author ci-and-gates-rules guideline
kind: task
status: open
priority: 1
version: 1
spec_path: docs/project/specs/active/plan-2026-08-23-rust-quality-floor-and-guideline-mapping.md
labels: []
dependencies: []
parent_id: is-01m0ph6ehhhryj0z52a1c3b3rv
created_at: 2026-08-23T05:24:42.240Z
updated_at: 2026-08-23T05:24:42.240Z
---
New language-neutral guideline. Absorbs the four CI, local-command-parity, automation-review, and dependency-policy sections from the playbook's rust-project-setup, the neutral half of typescript-lint-format-rules Hooks and Gates, and the practices this repo enforces but never documented: tracked ratchets carrying a tracker ID and re-enable condition (tbd-s9vn, tbd-tdh3); the config-contract check in scripts/check-eslint-contract.mjs that asserts effective severity rather than config text; the GIT_DIR scrub in both the hook wrapper and vitest setupFiles (tbd-a1lc); lefthook parallel:false because stage_fixed jobs contend on .git/index.lock; pnpm exec over npx so hooks never invoke a download-capable runner; generated files excluded from formatters and guarded by drift tests; fix-mode and verify-mode as separate scripts; and the .claude/worktrees ignore, since agent worktrees hold a nested mid-edit copy outside the tsconfig project.
