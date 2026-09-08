---
type: is
id: is-01m21kqfe9nnwmhsw39gs06nma
title: Update js-yaml 3.x override after security-fix cool-off
kind: bug
status: open
priority: 1
version: 1
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies: []
parent_id: is-01m1w3d1e63qg5e2wpz31qkmvn
deferred_until: 2026-09-10T21:00:00Z
created_at: 2026-09-08T22:55:25.640Z
updated_at: 2026-09-08T22:55:25.640Z
---
pnpm audit --prod on 2026-09-08 reports GHSA-2883-xcg3-v3hh through gray-matter -> js-yaml@3.15.1. Patched 3.15.2 was published 2026-08-26T20:53:50Z and is still inside the repository 14-day cool-off, so do not install it without a documented human-approved exception. After the cool-off, update only the js-yaml@3 override and lockfile in an isolated security PR; run package-age, audit, parser/YAML compatibility, full tests, packed upgrade, and inspect the upstream patch. Runtime parsing already routes through packages/tbd/src/utils/gray-matter.ts, but the vulnerable transitive package remains shipped and audit-visible.
