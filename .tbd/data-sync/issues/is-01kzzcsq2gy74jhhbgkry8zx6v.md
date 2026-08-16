---
type: is
id: is-01kzzcsq2gy74jhhbgkry8zx6v
title: "PR #216 review R5: doc-reference test mutates the source checkout"
kind: bug
status: closed
priority: 1
version: 2
labels:
  - review
dependencies: []
parent_id: is-01kzzbpmdv336m2wnrbqpx473c
created_at: 2026-08-14T05:44:26.447Z
updated_at: 2026-08-14T06:12:49.039Z
closed_at: 2026-08-14T06:12:49.039Z
close_reason: Fixed in bbad205b; complete local release matrix and PR CI are green
---
Full release validation for PR #216 showed packages/tbd/tests/doc-references.test.ts runs tbd setup --auto in MONOREPO_ROOT. On f07 code with the deliberately unstamped f06 release branch, a green pnpm test rewrites .tbd/config.yml and all managed agent surfaces. Make the test hermetic in a temporary directory and prove the source checkout remains untouched.
