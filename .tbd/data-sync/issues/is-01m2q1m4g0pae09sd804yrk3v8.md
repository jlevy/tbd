---
type: is
id: is-01m2q1m4g0pae09sd804yrk3v8
title: "P2: Split the generated integration format from the repository format"
kind: task
status: closed
priority: 1
version: 6
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
delegate: claude-code@spud10.local
labels:
  - exec:judgment
dependencies:
  - type: blocks
    target: is-01m2q1mgh888yxv1b6svra2n1m
  - type: blocks
    target: is-01m2pr2906rqnap8ry6ym5ceby
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
hold: null
hold_until: null
created_at: 2026-09-17T06:42:19.263Z
updated_at: 2026-09-17T09:54:28.914Z
started_at: 2026-09-17T06:54:05.086Z
closed_at: 2026-09-17T09:54:28.913Z
close_reason: Fable sub-agent split AGENT_INTEGRATION_FORMAT (f100) from CURRENT_FORMAT (f08) with tests proving 0.9.0-style parsing refuses f100; coordinator reviewed the diff and reran the 4 acceptance test files (112 passed); committed
resolution: null
duplicate_of: null
---
Plan: Policy Grants > Persistence; Background > tbd Constraints on Delegation (the format bullets); Implementation Plan Phase 2 item 1 ("the guard against older releases"); Document Changes row tbd-format-versioning.md. See also docs/tbd-format-versioning.md ("split these roles in code", Generated integration format).

What: give the generated integration format its own constant instead of aliasing CURRENT_FORMAT (packages/tbd/src/lib/integration-paths.ts). Keep the repository format, automatic migration target, and fresh default at f08. Bump only the integration format stamped into generated surfaces (the AGENTS.md begin marker, the SKILL.md DO NOT EDIT marker, and any other stamped surface), so that tbd 0.9.0 and older refuse to rewrite a block that may carry policy grants instead of deleting them. Point the newer-format guards in setup.ts and doctor.ts at the integration format. Generated hook scripts keep checking the repository format (`tbd_format`).
Decision needed (judgment; report it): the bumped value. Older binaries compare `format=fNN` numerically, so the value must parse as fNN above f08 for their guards to fire, but f09 is reserved for the native-comments repository format. Choose the value and document the choice and its reason in docs/tbd-format-versioning.md.

Write set: packages/tbd/src/lib/integration-paths.ts; packages/tbd/src/lib/tbd-format.ts (comments and exports only as needed); packages/tbd/src/cli/lib/managed-artifact.ts; packages/tbd/src/cli/commands/setup.ts; packages/tbd/src/cli/commands/doctor.ts; docs/tbd-format-versioning.md; tests: packages/tbd/tests/tbd-format.test.ts, setup-flows.test.ts (integration format guard describe), doctor-managed-surfaces.test.ts, setup-dry-run-state.test.ts if affected. Do not regenerate the committed AGENTS.md or skill copies (packaging bead tbd-sqat).

Acceptance: `pnpm --filter get-tbd exec vitest run tests/tbd-format.test.ts tests/setup-flows.test.ts tests/doctor-managed-surfaces.test.ts tests/setup-dry-run-state.test.ts`; typecheck, prettier, eslint on changed files; Markdown check on tbd-format-versioning.md.

Rules: the coordinator commits and syncs. Do not commit, push, run `tbd sync`, or edit the plan spec unless the write set lists it. Keep scratch files in the session scratch directory. Run only the targeted checks listed, not the full suite.
Markdown check: `uvx --exclude-newer-package flowmark-rs=2026-05-31 flowmark-rs@0.3.1 --auto --check <files>` (per-file form of `pnpm format:md:check`). TypeScript checks: `pnpm exec prettier --check <files>`, `pnpm exec eslint <files>`, `pnpm --filter get-tbd typecheck`. Tests that read `packages/tbd/dist/` (integration-files, doc-references, setup-flows, golden-output, tryscripts) need a current build: run `pnpm --filter get-tbd build` once if dist is stale.
