---
type: is
id: is-01m6yv6tdp32n5pqrw2fwb7vp9
title: "PR #332 B2: shared npx fallback cache can carry one repository's registry override into others"
kind: bug
status: open
priority: 3
version: 1
labels: []
dependencies: []
parent_id: is-01m6yv6qega7ts908s41sm9pqm
created_at: 2026-11-09T00:26:54.261Z
updated_at: 2026-11-09T00:26:54.261Z
---
Low, hardening (main had the same reuse via the default npx cache). The fallback runs after cd into the repository, so its .npmrc registry decides where get-tbd@<pin> comes from, and the result lands in the shared tbd-fallback-npm cache keyed by spec. Options: pass --registry=https://registry.npmjs.org/ (breaks private mirrors) or key the cache directory by a hash of the effective registry. Needs an owner decision on private mirrors; fsqlite's harness asserts the exact npx argv, so change both together. Review: https://github.com/jlevy/tbd/pull/332#pullrequestreview-5820357750
