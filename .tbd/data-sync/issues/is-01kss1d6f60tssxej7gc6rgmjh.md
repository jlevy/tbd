---
type: is
id: is-01kss1d6f60tssxej7gc6rgmjh
title: QA playbook still links to moved tbd-format-versioning guide
kind: bug
status: closed
priority: 2
version: 3
spec_path: tests/qa/release-v0.2.0-upgrade.qa.md
labels:
  - v0.2.0
  - docs
dependencies: []
parent_id: is-01ksrpdkemmkkhh4j6egqyrvsq
created_at: 2026-05-29T04:55:44.357Z
updated_at: 2026-05-29T05:05:28.421Z
closed_at: 2026-05-29T05:05:28.420Z
close_reason: "Already fixed at current PR head: QA playbook now links to docs/tbd-format-versioning.md."
---
After commit 2ff363f moved packages/tbd/docs/guidelines/tbd-format-versioning.md to docs/tbd-format-versioning.md, tests/qa/release-v0.2.0-upgrade.qa.md still references the old path in the references section. Update the link before release so the playbook matches the final repo layout. Found during senior release review.
