---
type: is
id: is-01m2nn46sgxpv5sm7j4xcbvqas
title: Harden formal-stack adoption, sync, and diff-base postconditions
kind: bug
status: in_progress
priority: 1
version: 2
delegate: codex@spud10
labels:
  - git
  - docs
dependencies: []
hold: null
hold_until: null
created_at: 2026-09-16T17:44:39.982Z
updated_at: 2026-09-16T17:44:52.485Z
started_at: 2026-09-16T17:44:52.475Z
---
Formal-stack workflows still need three postconditions discovered after PR #301 opened: (1) remote-only stack adoption must apply the official gh-stack checkout-conflict preflight so checkout cannot block on an unbypassable prompt; (2) gh stack sync can print "Sync aborted — no changes were made" and exit 0, so workflows must inspect output and verify the final stack; (3) an existing or published PR must diff against the fetched remote base, not a stale same-named local branch. Also narrow generated top-level routing so review-only PR work is not mislabeled as create/update. Update the stacked-prs, PR creation, merge-upstream, and address-review shortcuts plus focused generator/integration tests.
