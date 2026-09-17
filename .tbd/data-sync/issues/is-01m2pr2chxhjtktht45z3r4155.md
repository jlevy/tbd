---
type: is
id: is-01m2pr2chxhjtktht45z3r4155
title: "P2: Add review-code-security, review-code-performance, and review-code-correctness shortcuts"
kind: task
status: closed
priority: 1
version: 7
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
delegate: claude-code@spud10.local
labels:
  - exec:judgment
dependencies:
  - type: blocks
    target: is-01m2pr2bttb3sw9d036ejwtp4t
  - type: blocks
    target: is-01m2pr28mh17t3tye60mc3jggs
  - type: blocks
    target: is-01m2q2590d5x1nx544vc8f42a3
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
hold: null
hold_until: null
created_at: 2026-09-17T03:55:20.508Z
updated_at: 2026-09-17T10:32:13.519Z
started_at: 2026-09-17T10:15:46.611Z
closed_at: 2026-09-17T10:32:13.519Z
close_reason: "Batch 3 verified by the coordinator: 133 tests in 8 files passed (setup-policy-grants, setup-flows, policy-grants, cli-policy, setup-dry-run-state, doctor-managed-surfaces, doc-categories, integration-files); typecheck, eslint, prettier, flowmark clean; committed"
resolution: null
duplicate_of: null
---
Plan: Review Coverage and Rounds > Dedicated reviews; Implementation Plan Phase 2 item "Add the review-code-security, review-code-performance, and review-code-correctness shortcuts"; Document Changes row for the three shortcuts. Decision made: three dedicated shortcuts (not focus sections in review-code).

What: three new shortcuts, each built on review-code (same pinned-head, test-running, and report-every-finding rules), with a focused checklist for its area, the sensitivity triggers from the plan's lists (security: authn/authz, secrets, untrusted input, network exposure, sandboxing and permissions, file-system mutation, dependency or build-time execution; performance: hot paths, large data, latency, memory and resources; correctness: concurrency and locking, data integrity and persisted formats, migrations, sync and merge algorithms, numerical calculations), and the topic guidelines to load. Header kind is security, performance, or correctness; each is its own published review with its own letter, addressed like any other review.
Judgment: tbd has no security or performance guideline today. Choose the relevant existing guidelines (for example supply-chain-hardening, filesystem-rules, error-handling-rules, backward-compatibility-rules, general-testing-rules, and the language guidelines) and name them; report whether a missing topic guideline should become a follow-up bead. Frontmatter category `review`, like review-code-rust.

Write set: packages/tbd/docs/shortcuts/standard/review-code-security.md, review-code-performance.md, review-code-correctness.md (all new).

Acceptance: Markdown check; `pnpm --filter get-tbd exec vitest run tests/doc-categories.test.ts` passes.

Rules: the coordinator commits and syncs. Do not commit, push, run `tbd sync`, or edit the plan spec unless the write set lists it. Keep scratch files in the session scratch directory. Run only the targeted checks listed, not the full suite.
Markdown check: `uvx --exclude-newer-package flowmark-rs=2026-05-31 flowmark-rs@0.3.1 --auto --check <files>` (per-file form of `pnpm format:md:check`). TypeScript checks: `pnpm exec prettier --check <files>`, `pnpm exec eslint <files>`, `pnpm --filter get-tbd typecheck`. Tests that read `packages/tbd/dist/` (integration-files, doc-references, setup-flows, golden-output, tryscripts) need a current build: run `pnpm --filter get-tbd build` once if dist is stale.
