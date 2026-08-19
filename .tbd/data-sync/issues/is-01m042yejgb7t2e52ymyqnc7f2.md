---
type: is
id: is-01m042yejgb7t2e52ymyqnc7f2
title: Verify package manager status for Electron (npm, pnpm, Bun) and correct stale Bun claims
kind: task
status: closed
priority: 1
version: 2
labels: []
dependencies: []
parent_id: is-01m042xcf06tnmqey8pcfwwswt
created_at: 2026-08-16T01:28:27.984Z
updated_at: 2026-08-16T01:36:30.607Z
closed_at: 2026-08-16T01:36:30.607Z
close_reason: "Re-checked all five cited issues. Bun segfault and install issues closed; forge#3906 still open; bun#9895 still open. Captured npm 12 allowScripts, pnpm 11 allowBuilds and the .npmrc-to-pnpm-workspace.yaml move, Bun trustedDependencies. Key finding: Electron 42+ downloads its binary lazily, not via postinstall, so most of this only applies to Electron <= 41."
---
The current guideline rates Bun 'Low stability / blocked' on the basis of 2024-2025 issues. Re-check each cited issue for current state. Also capture the pnpm 10 onlyBuiltDependencies problem, which breaks electron's postinstall and is not documented anywhere in the current guideline.
