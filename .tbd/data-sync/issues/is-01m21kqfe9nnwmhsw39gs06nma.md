---
type: is
id: is-01m21kqfe9nnwmhsw39gs06nma
title: Update js-yaml 3.x override after security-fix cool-off
kind: bug
status: open
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies: []
parent_id: is-01m1w3d1e63qg5e2wpz31qkmvn
deferred_until: 2026-09-09T21:00:00.000Z
created_at: 2026-09-08T22:55:25.640Z
updated_at: 2026-09-08T23:35:18.227Z
---
pnpm audit --prod on 2026-09-08 reports GHSA-2883-xcg3-v3hh through gray-matter -> js-yaml@3.15.1. Patched 3.15.2 was published 2026-08-26T20:53:50Z and is still inside the repository 14-day cool-off, so do not install it without a documented human-approved exception. After the cool-off, update only the js-yaml@3 override and lockfile in an isolated security PR; run package-age, audit, parser/YAML compatibility, full tests, packed upgrade, and inspect the upstream patch. Runtime parsing already routes through packages/tbd/src/utils/gray-matter.ts, but the vulnerable transitive package remains shipped and audit-visible.

## Notes

GHSA published 2026-09-08T21:24:51Z and immediately made PR #279 Coverage & Lint fail at pnpm audit before coverage. Verified npm metadata: js-yaml 3.15.2 was published 2026-08-26T20:53:50.335Z, integrity sha512-6EuL879VkRA+1Cz578mKMiKvjPNEuk6+r1JaFzoSWejZmtf7xWbIyw1e3KkxlkzTIt9Taw6JBhEppG7utc1P+w==, gitHead 5c45bd6e960603c13644f5cc8b572ca257723b36. Compared 3.15.1...3.15.2: four commits, security backport 3485bc06ff8a0251505f44a00414d90df2466639, dist rebuild, changelog/version, and ignore-file additions. Minimal unblock is the existing override 3.15.1 to 3.15.2 in a separate security PR. This is about 21 hours short of the 14-day floor as of the CI failure; SUPPLY-CHAIN-SECURITY.md requires documented human approval for an early security exception.
