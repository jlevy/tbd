---
type: is
id: is-01m044qg77sr6cpwasm0qkhcbq
title: Two goldens invert when 0.7.0 ships, and will 'break' on success
kind: task
status: open
priority: 2
version: 4
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - phase-4
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-16T01:59:37.390Z
updated_at: 2026-08-16T22:21:30.586Z
extensions:
  linear:
    id: e4fe7e8d-63cc-4b9b-8485-a712bc5175dc
    linked_at: 2026-08-16T02:12:01.319Z
---
Two goldens invert when 0.7.0 ships. Split by when each can be done.

DONE (in the release commit): the doctor's 'Launcher fallback' warning disappears once the running version can read f08, so cli-orientation-golden.tryscript.md now expects a plain '✓ Launcher fallback'.

AFTER PUBLISH: validate-upgrade-package.mjs regains a genuine same-format baseline. sameFormatBaseline currently defaults to 0.6.3 (an f07 client, which must fail closed against an f08 candidate). Once 0.7.0 is on npm, set TBD_UPGRADE_SAME_FORMAT_FROM=0.7.0 — or change the default — so the suite proves an f08 client upgrading an f08 repository. This cannot be done before publishing because the script installs the baseline from the registry.
