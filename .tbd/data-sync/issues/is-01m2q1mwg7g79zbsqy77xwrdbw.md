---
type: is
id: is-01m2q1mwg7g79zbsqy77xwrdbw
title: "P3: Fix tbd integration --help to name Linear only"
kind: task
status: closed
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
delegate: claude-code@spud10.local
labels:
  - exec:mechanical
dependencies:
  - type: blocks
    target: is-01m2pr2d9920ppbyepz0w9ne4f
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
hold: null
hold_until: null
created_at: 2026-09-17T06:42:43.846Z
updated_at: 2026-09-17T10:16:19.689Z
started_at: 2026-09-17T10:15:39.877Z
closed_at: 2026-09-17T10:16:19.688Z
close_reason: Help string changed to name Linear only; cli-setup tryscript 16/16 after build; prettier and eslint clean; no remaining 'Linear, GitHub' in src, tests, docs, or README
resolution: null
duplicate_of: null
---
Plan: Final Documentation Updates > README Problems Today (last bullet) and Other Documentation Updates > `tbd integration --help`; Implementation Plan Phase 3 item 3.

What: change the integration command description "Manage external tracker integrations (Linear, GitHub)" to name Linear only, since no GitHub adapter exists, and update every help golden that contains it.

Write set: packages/tbd/src/cli/commands/integration.ts; packages/tbd/tests/cli-setup.tryscript.md (top-level help); any other golden containing the string (check with grep).

Acceptance: after a build, `pnpm --filter get-tbd exec tryscript run tests/cli-setup.tryscript.md`; `grep -rn "Linear, GitHub" packages/tbd/src packages/tbd/tests packages/tbd/docs README.md` finds nothing; prettier and eslint on integration.ts.

Rules: the coordinator commits and syncs. Do not commit, push, run `tbd sync`, or edit the plan spec unless the write set lists it. Keep scratch files in the session scratch directory. Run only the targeted checks listed, not the full suite.
Markdown check: `uvx --exclude-newer-package flowmark-rs=2026-05-31 flowmark-rs@0.3.1 --auto --check <files>` (per-file form of `pnpm format:md:check`). TypeScript checks: `pnpm exec prettier --check <files>`, `pnpm exec eslint <files>`, `pnpm --filter get-tbd typecheck`. Tests that read `packages/tbd/dist/` (integration-files, doc-references, setup-flows, golden-output, tryscripts) need a current build: run `pnpm --filter get-tbd build` once if dist is stale.
