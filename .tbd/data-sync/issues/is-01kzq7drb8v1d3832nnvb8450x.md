---
type: is
id: is-01kzq7drb8v1d3832nnvb8450x
title: Harden immediate tbd watch integration test against suite-load flake
kind: bug
status: open
priority: 2
version: 1
labels:
  - testing
  - watch
dependencies: []
created_at: 2026-08-11T01:36:36.199Z
updated_at: 2026-08-11T01:36:36.199Z
---
The exact PR 207 head full unit run had 1457 passes and one failure: cli-watch immediately reports changes after --since exited 1 with a one-second command timeout. The file passed in isolation and across five additional consecutive reruns, and GitHub CI is green on Linux, macOS, and Windows. Determine whether the one-second timeout should be separated from the semantic assertion or made load-tolerant without weakening watch behavior.
