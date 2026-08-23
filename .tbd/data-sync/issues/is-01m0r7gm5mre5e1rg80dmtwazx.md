---
type: is
id: is-01m0r7gm5mre5e1rg80dmtwazx
title: Extend action-pin gate to composite actions and Docker digests
kind: bug
status: open
priority: 3
version: 1
labels:
  - ci
  - security
dependencies: []
created_at: 2026-08-23T21:13:06.483Z
updated_at: 2026-08-23T21:13:06.483Z
---
scripts/check-action-pins.mjs currently parses workflow job and step references but does not recurse into .github/actions/**/action.yml for nested third-party uses. It also reports Docker references with a commit-SHA-only remediation even though immutable Docker pins use sha256 digests. Add structural composite-action parsing plus positive and negative fixtures for both reference classes.
