---
type: is
id: is-01m2k16ac1effhq4ent72gcqjp
title: Remediate locked dev-tool audit advisories
kind: bug
status: open
priority: 1
version: 1
labels: []
dependencies: []
created_at: 2026-09-15T17:17:48.800Z
updated_at: 2026-09-15T17:17:48.800Z
---
A frozen, scripts-disabled install on 2026-09-15 followed by pnpm audit found 36 development-tool advisories (1 critical, 24 high, 11 moderate), including GHSA-5xrq-8626-4rwp and GHSA-82fw-gwwq-j7x9 in Vitest plus transitive Vite/Rollup/minimatch issues. pnpm audit --prod reported no known vulnerabilities. Triage cooldown-eligible upgrades under SUPPLY-CHAIN-SECURITY.md; do not launch the Vitest UI/server before remediation.
