---
type: is
id: is-01kzz0qxe6xhbzwk7zv6wysftf
title: Prepare get-tbd v0.6.0 release metadata
kind: task
status: closed
priority: 1
version: 4
labels:
  - release
  - linear
dependencies: []
parent_id: is-01kzz0cgt3p51mrh1rt5bg9ypq
created_at: 2026-08-14T02:13:44.518Z
updated_at: 2026-08-14T06:12:49.045Z
closed_at: 2026-08-14T06:12:49.045Z
close_reason: Fixed in bbad205b; complete local release matrix and PR CI are green
---
Convert the complete post-v0.5.0 Linear and stabilization delta into a release-guideline-compliant v0.6.0 changelog section, bump the published package version, and document the production and development audit disposition.

## Notes

PR #216 formal review R3 (review 4934238677): packages/tbd/CHANGELOG.md:7 must tell users to run tbd setup --auto because ordinary read-only commands migrate f07 only in memory.
