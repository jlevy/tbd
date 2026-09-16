---
type: is
id: is-01kzx8knkqyxmghreewwsy16h9
title: Validate GitHub integration through the built CLI and a live pilot repository
kind: task
status: open
priority: 2
version: 6
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - github
  - integration
  - release-candidate
dependencies:
  - type: blocks
    target: is-01kzn515e154th2ehqthkpcv0v
parent_id: is-01kzn2wakpq2963exxqhj8xkdc
created_at: 2026-08-13T09:52:45.174Z
updated_at: 2026-09-16T00:18:17.326Z
extensions:
  linear:
    id: 4fb64dc7-d929-4ac3-81d2-f9040582f16c
    linked_at: 2026-08-13T16:00:41.862Z
    key: TBD-156
    url: https://linear.app/finterm-ai/issue/TBD-156/validate-github-integration-through-the-built-cli-and-a-live-pilot
---
After the GitHub adapter, issue lifecycle, and PR-association work land, run mock-server real-binary E2E plus a bounded live pilot against a disposable GitHub issue and PR. Prove status and gh-token fallback, link, sync --pull --external, sync --push, full sync, comments, unlink, PR association and Linear attachment rendering, crash replay, strict pull deferral, local and remote duplicate guards, rate-limit and permission remedies, cross-clone convergence, and no mutation of PR content. Audit and clean up the pilot, then run the full quality and package gates.

## Notes

Live-gate material salvaged from closed PR #83: its manual QA script is at git show 4795e47f:docs/project/qa/external-issues.qa.md. Do not copy it into the repo. Its command vocabulary is obsolete (tbd sync --external, --external-issue, tbd list --external-issue) and its inheritance and propagation phases test a design that no longer exists. What is reusable is the disposable-pilot skeleton: create a throwaway GitHub repo and a few issues, record their URLs, drive the lifecycle, assert through the API rather than the UI, and delete the repo at the end, with a cleanup trap in its semi-automated shell variant. The real basis for this gate stays packages/tbd/scripts/provider-live-qa-contract.ts plus the Linear playbook at packages/tbd/tests/qa/linear-integration.qa.md, reusing the same scenario ids and adding only GitHub-specific rows. Provider facts and the list of behaviors that can only be settled by writing to a live repo are in docs/project/research/current/research-2026-09-15-github-issues-for-tracker-adapter.md section 12 (PR #295): label auto-creation, id survival across a transfer, sub-issue limit enforcement, and what bumps issue updated_at. Content-creating requests are capped at 80 per minute and 500 per hour, which is the binding rate limit for a pilot that creates issues and comments.
