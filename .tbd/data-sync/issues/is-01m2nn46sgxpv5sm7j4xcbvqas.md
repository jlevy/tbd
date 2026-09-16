---
type: is
id: is-01m2nn46sgxpv5sm7j4xcbvqas
title: Harden formal-stack adoption, sync, and diff-base postconditions
kind: bug
status: closed
priority: 1
version: 4
delegate: codex@spud10
labels:
  - git
  - docs
dependencies: []
hold: null
hold_until: null
created_at: 2026-09-16T17:44:39.982Z
updated_at: 2026-09-16T18:14:47.759Z
started_at: 2026-09-16T17:44:52.475Z
closed_at: 2026-09-16T18:14:47.758Z
close_reason: Formal-stack checkout, sync, diff-base, and top-level routing postconditions are documented and covered by focused tests.
resolution: null
duplicate_of: null
---
Formal-stack workflows still need three postconditions discovered after PR #301 opened: (1) remote-only stack adoption must apply the official gh-stack checkout-conflict preflight so checkout cannot block on an unbypassable prompt; (2) gh stack sync can print "Sync aborted — no changes were made" and exit 0, so workflows must inspect output and verify the final stack; (3) an existing or published PR must diff against the fetched remote base, not a stale same-named local branch. Also narrow generated top-level routing so review-only PR work is not mislabeled as create/update. Update the stacked-prs, PR creation, merge-upstream, and address-review shortcuts plus focused generator/integration tests.

## Notes

Reviewed and accepted the existing formal-stack postcondition changes for inclusion in PR #301. Added noninteractive checkout-conflict preflight before adopting remote-only stacks; treats gh stack sync output containing "Sync aborted" as failure even when exit status is 0 and requires a final stack view; existing/published PR diffs use fetched origin/<base> instead of a stale same-named local branch; generated top-level routing is narrowed to PR creation/update so review-only requests are not misrouted. Independent subagent review found no issues and validated behavior against the pinned github/gh-stack skill. Focused integration-files and setup-flows tests passed 66/66; the combined installer/setup/integration suite passed 100/100.
