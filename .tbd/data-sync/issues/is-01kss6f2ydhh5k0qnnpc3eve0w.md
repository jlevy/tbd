---
type: is
id: is-01kss6f2ydhh5k0qnnpc3eve0w
title: "[task] Bump pnpm/action-setup and softprops/action-gh-release to support Node 24"
kind: task
status: open
priority: 3
version: 1
spec_path: tests/qa/release-v0.2.0-upgrade.qa.md
labels: []
dependencies: []
parent_id: is-01ksrpb7b8cfwrzzd34ya9874q
created_at: 2026-05-29T06:24:09.160Z
updated_at: 2026-05-29T06:24:09.160Z
---
release.yml v0.2.0 run surfaced this annotation: 'Node.js 20 actions are deprecated. The following actions are running on Node.js 20 and may not work as expected: pnpm/action-setup@v4, softprops/action-gh-release@v2. Actions will be forced to run with Node.js 24 by default starting June 2nd, 2026.'

Not release-blocking, but flow-blocking once GH Actions enforces the deprecation. Check for newer major versions of both actions and bump. May also need to bump ci.yml uses (actions/checkout, actions/setup-node) for consistency.
