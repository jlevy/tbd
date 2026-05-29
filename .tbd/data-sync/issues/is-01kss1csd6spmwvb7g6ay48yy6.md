---
type: is
id: is-01kss1csd6spmwvb7g6ay48yy6
title: "Release blocker: DeepSource Secrets check fails on PR #138"
kind: bug
status: closed
priority: 0
version: 4
spec_path: tests/qa/release-v0.2.0-upgrade.qa.md
labels:
  - v0.2.0
  - release-blocker
dependencies: []
parent_id: is-01ksrpdkemmkkhh4j6egqyrvsq
created_at: 2026-05-29T04:55:30.981Z
updated_at: 2026-05-29T05:01:13.272Z
closed_at: 2026-05-29T05:01:13.271Z
close_reason: "User-confirmed false positive: DeepSource Secrets flagged on docs prose in the v0.2.0 release PR. The diff actually REMOVED a high-entropy dev-SHA pin (0.1.31-dev.38.e2f8029) and only added documentation strings. Not investigating individual findings; dismissing as a known scanner artifact for the release. Tracked in PR #138 senior review (jlevy comment 4570774002)."
---
PR #138 latest head 2ff363fc027fdebe100b6e11b70e48f0ab7525a1 has all GitHub Actions checks passing, but the DeepSource: Secrets status is failing: https://app.deepsource.com/gh/jlevy/tbd/run/226fb63c-e3a2-4759-a191-1588fa02865b/secrets/. Do not cut v0.2.0 until this is cleared or explicitly dismissed in DeepSource/GitHub. Found during senior release review.
