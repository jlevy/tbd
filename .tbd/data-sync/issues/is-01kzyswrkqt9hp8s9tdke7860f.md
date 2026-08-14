---
type: is
id: is-01kzyswrkqt9hp8s9tdke7860f
title: Preserve Node 20 CLI startup when Linear is inactive
kind: bug
status: closed
priority: 1
version: 4
labels: []
dependencies: []
parent_id: is-01kzysmb4s1ntzjgq5e7yhfpmr
created_at: 2026-08-14T00:14:03.368Z
updated_at: 2026-08-14T00:44:11.899Z
closed_at: 2026-08-14T00:44:11.898Z
close_reason: "Fixed in PR #215; Node 20.0 no-integration and process-env credential smokes pass, full local and hosted CI green."
---
The merged build statically imports node:util parseEnv, which does not exist in Node 20.0 and crashes the entire CLI before config is read. Preserve the existing Node >=20 contract for users with no enabled integration; gate .env parsing itself with an actionable Node 20.12 requirement and add regression coverage plus a real Node 20.0 built-CLI smoke test.

## Notes

Regression tests pass. Built CLI starts on Node 20.0; a disposable repository completed setup, status, doctor, create, sync, and list with no integrations configured. Process-env Linear credentials also work on Node 20.0. Only .env parsing returns the documented Node 20.12 upgrade-or-export remedy.
