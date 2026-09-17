---
type: is
id: is-01m2pr27jhgh5jf7k9k3320pfb
title: "P1: Update review-github-pr for pinned, marked reviews and dedicated review kinds"
kind: task
status: closed
priority: 1
version: 7
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
delegate: claude-code@spud10.local
labels:
  - exec:mechanical
dependencies:
  - type: blocks
    target: is-01m2pr28mh17t3tye60mc3jggs
  - type: blocks
    target: is-01m2pr2bttb3sw9d036ejwtp4t
  - type: blocks
    target: is-01m2q2590d5x1nx544vc8f42a3
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
hold: null
hold_until: null
created_at: 2026-09-17T03:55:15.409Z
updated_at: 2026-09-17T10:15:06.954Z
started_at: 2026-09-17T09:56:48.019Z
closed_at: 2026-09-17T10:15:06.954Z
close_reason: "Batch 2 verified by the coordinator: rebuilt dist and skills copy; 146 tests in the 9 acceptance files passed; typecheck, eslint, prettier, and flowmark clean; tbd policy smoke-tested; committed one commit per bead"
resolution: null
duplicate_of: null
---
Plan: Document Changes row review-github-pr; Review-State Contract; Review Coverage and Rounds (dedicated reviews, follow-up rounds).

What: record `headRefOid` and the merge base before starting and check out that head; run the full discovery sweep (formal reviews, inline review comments, PR comments, issues referencing the PR, linked review docs; match marked content by marker, the rest by reading); write the visible header and hidden marker; choose a review letter not used on the PR and re-check immediately before publishing; publish a formal review through the reviews API with `commit_id` set to the pinned head by default, or use the channel the user asked for (PR comment, GitHub issue, review doc, or report only) with the same header; re-read `headRefOid` before publishing and handle a moved head as the plan says; follow-up review mode (kind=follow-up: the fix commits since the reviewed head plus the Blocker and High dispositions); dedicated security, performance, and correctness reviews per pr-review-requirements using review-code-security, review-code-performance, and review-code-correctness, stating which areas apply and why and asking when unclear; replace "temp file" with "session scratch directory"; when run by a coordinator, return a summary and the review URL rather than the full body.

Write set: packages/tbd/docs/shortcuts/standard/review-github-pr.md.

Acceptance: Markdown check; `pnpm --filter get-tbd exec vitest run tests/integration-files.test.ts` passes (read-only).

Rules: the coordinator commits and syncs. Do not commit, push, run `tbd sync`, or edit the plan spec unless the write set lists it. Keep scratch files in the session scratch directory. Run only the targeted checks listed, not the full suite.
Markdown check: `uvx --exclude-newer-package flowmark-rs=2026-05-31 flowmark-rs@0.3.1 --auto --check <files>` (per-file form of `pnpm format:md:check`). TypeScript checks: `pnpm exec prettier --check <files>`, `pnpm exec eslint <files>`, `pnpm --filter get-tbd typecheck`. Tests that read `packages/tbd/dist/` (integration-files, doc-references, setup-flows, golden-output, tryscripts) need a current build: run `pnpm --filter get-tbd build` once if dist is stale.
