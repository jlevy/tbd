---
type: is
id: is-01m3re9tyyhj4w25tdb2h8dk2w
title: Remediate 45 audit advisories in the existing tbd development lockfile
kind: task
status: open
priority: 1
version: 1
labels: []
dependencies: []
created_at: 2026-09-30T05:58:49.565Z
updated_at: 2026-09-30T05:58:49.565Z
---
Found during stack #309/#310 review September 30, 2026: pnpm audit reports 1 critical, 30 high, 14 moderate in unchanged lockfile. Critical Vitest UI RCE GHSA-5xrq-8626-4rwp; run-only trusted fixtures do not start that UI. Review advisory paths, select patched versions at least 14 days old, apply minimum coordinated updates, audit and run full gates. No dependency changes in this review stack.
