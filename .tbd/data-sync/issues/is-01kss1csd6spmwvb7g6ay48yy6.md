---
type: is
id: is-01kss1csd6spmwvb7g6ay48yy6
title: "Release blocker: DeepSource Secrets check fails on PR #138"
kind: bug
status: open
priority: 0
version: 1
spec_path: tests/qa/release-v0.2.0-upgrade.qa.md
labels:
  - v0.2.0
  - release-blocker
dependencies: []
parent_id: is-01ksrpdkemmkkhh4j6egqyrvsq
created_at: 2026-05-29T04:55:30.981Z
updated_at: 2026-05-29T04:55:30.981Z
---
PR #138 latest head 2ff363fc027fdebe100b6e11b70e48f0ab7525a1 has all GitHub Actions checks passing, but the DeepSource: Secrets status is failing: https://app.deepsource.com/gh/jlevy/tbd/run/226fb63c-e3a2-4759-a191-1588fa02865b/secrets/. Do not cut v0.2.0 until this is cleared or explicitly dismissed in DeepSource/GitHub. Found during senior release review.
