---
type: is
id: is-01kss6er2p7pfg2v0wt4vqcjbp
title: "[task] Release gate must be main CI green, not 'looks mostly green'; document and enforce"
kind: task
status: closed
priority: 1
version: 2
spec_path: tests/qa/release-v0.2.0-upgrade.qa.md
labels:
  - v0.2.0
dependencies: []
parent_id: is-01ksrpb7b8cfwrzzd34ya9874q
created_at: 2026-05-29T06:23:58.037Z
updated_at: 2026-05-29T16:22:02.589Z
closed_at: 2026-05-29T16:22:02.588Z
close_reason: "Fixed in #140 (merged 2f5746e): release tagging gated on main CI success for the exact merge commit across all documented paths."
---
Process failure during v0.2.0 cut: tagged v0.2.0 and declared the release shipped while main CI on the merge commit was still in_progress (4/5 jobs green, Windows hanging on a known flake). User correctly called this out: 'you shouldnt be able to tell me a release is pushed successfully if the CI has failed.'

Fix the process:
- docs/publishing.md must state explicitly: tag only after main CI on the merge commit reaches conclusion=success. No 'looks green except the flaky Windows job' shortcuts.
- The agent loop must use a CI gate that checks RUN-level conclusion (or all job conclusions), not just whichever jobs happened to finish first.
- If a job is hanging on a known flake, the policy is to cancel + rerun (or fix the flake) and wait again, not to ship past it.
- Add a release-prep checklist step that says 'npm view get-tbd@<new-version> dist-tags AND gh release view v<new-version> --json body --jq .body | head' and asserts the body is the CHANGELOG section, not the fallback Release vX.Y.Z text. (See sibling bead for the release.yml fix.)

Acceptance: a follow-up release uses the updated docs/publishing.md and the agent does not declare the release done until those gates are satisfied.
