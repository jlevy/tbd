---
type: is
id: is-01kzz0qwy10rwp19x3f6wxw4z6
title: Release workflow can publish mismatched tag/package/changelog
kind: bug
status: closed
priority: 1
version: 4
labels:
  - release
  - security
dependencies: []
parent_id: is-01kzz0cgt3p51mrh1rt5bg9ypq
created_at: 2026-08-14T02:13:44.000Z
updated_at: 2026-08-14T06:12:49.019Z
closed_at: 2026-08-14T06:12:49.019Z
close_reason: Fixed in bbad205b; complete local release matrix and PR CI are green
---
The tag-triggered release workflow derives a version from the tag but never compares it with packages/tbd/package.json, and the changelog extractor falls back to a generic body when the exact version section is absent. This can publish one npm version under a different git/GitHub release version while CI stays green. Add a tested pre-publish verifier and make missing or mismatched release metadata fail closed.

## Notes

PR #216 formal review R1 (review 4934238677): .github/workflows/release.yml:40 must fail closed unless tag, packages/tbd/package.json, and the exact changelog section agree.
