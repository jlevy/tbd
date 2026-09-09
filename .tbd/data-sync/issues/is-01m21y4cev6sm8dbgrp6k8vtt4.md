---
type: is
id: is-01m21y4cev6sm8dbgrp6k8vtt4
title: Include pnpm overrides in package-age enforcement
kind: bug
status: open
priority: 1
version: 1
labels:
  - supply-chain
dependencies: []
created_at: 2026-09-09T01:57:14.331Z
updated_at: 2026-09-09T01:57:14.331Z
---
scripts/check-package-age.mjs currently scans dependency sections but omits root pnpm.overrides. As a result, exact override pins younger than the 14-day cool-off report zero violations. Extend the checker and tests to inspect override targets, and add a first-class documented exception mechanism so security patches can be reviewed and recorded without bypassing unrelated checks.
