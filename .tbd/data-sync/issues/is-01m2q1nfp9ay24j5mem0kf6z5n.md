---
type: is
id: is-01m2q1nfp9ay24j5mem0kf6z5n
title: "P3: Update tbd-design, docs-overview, development docs, and the changelog"
kind: task
status: open
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels:
  - exec:mechanical
dependencies:
  - type: blocks
    target: is-01m2pr2d9920ppbyepz0w9ne4f
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
created_at: 2026-09-17T06:43:03.478Z
updated_at: 2026-09-17T06:45:02.113Z
---
Plan: Final Documentation Updates > Other Documentation Updates (tbd-design.md, docs/docs-overview.md, docs/development.md, CHANGELOG.md); Document Changes row "tbd-design.md" (the design doc half; tbd-format-versioning.md is in the format-split bead (tbd-eeoi)); README Changes item 1 (design doc capability list); Rollout Plan (changelog entry); Implementation Plan Phase 3 item 2 for these files.

What:
- tbd-design.md: align the capability list with the revised README and the skill; document the policy block, its markers and placement, preservation on setup, the split integration format (link docs/tbd-format-versioning.md), `tbd policy`, and the tier agent definition surfaces (likely §4 CLI Layer and §6.4 Installation and Agent Integration).
- docs/docs-overview.md: list this plan and research-2026-09-16-subagent-guidance-anthropic-openai.md.
- docs/development.md: extend the list of contracts stated consistently across docs to the review vocabulary and policy grants, naming the tests that pin them.
- packages/tbd/CHANGELOG.md: an entry for the next release covering the new requests, the review marker format, policy grants, `tbd policy`, and the Rollout Plan note to upgrade every writer that runs `tbd setup` before recording grants.
Decision to confirm with the coordinator: the changelog version heading (docs/publishing.md requires exactly "## X.X.X").

Write set: packages/tbd/docs/tbd-design.md; docs/docs-overview.md; docs/development.md; packages/tbd/CHANGELOG.md.

Acceptance: Markdown check on all four files.

Rules: the coordinator commits and syncs. Do not commit, push, run `tbd sync`, or edit the plan spec unless the write set lists it. Keep scratch files in the session scratch directory. Run only the targeted checks listed, not the full suite.
Markdown check: `uvx --exclude-newer-package flowmark-rs=2026-05-31 flowmark-rs@0.3.1 --auto --check <files>` (per-file form of `pnpm format:md:check`). TypeScript checks: `pnpm exec prettier --check <files>`, `pnpm exec eslint <files>`, `pnpm --filter get-tbd typecheck`. Tests that read `packages/tbd/dist/` (integration-files, doc-references, setup-flows, golden-output, tryscripts) need a current build: run `pnpm --filter get-tbd build` once if dist is stale.
