---
type: is
id: is-01m0ddfjd4q6zawvdwh008w9h2
title: Name the .env source in integration status output
kind: task
status: open
priority: 0
version: 5
spec_path: docs/project/specs/active/plan-2026-08-19-worktree-env-credential-resolution.md
assignee: josh
labels: []
dependencies:
  - type: blocks
    target: is-01m0ddfjqnxkmpcqn4defgqe40
parent_id: is-01m0ddenmjsxeqm98ytfpcfc11
created_at: 2026-08-19T16:25:44.612Z
updated_at: 2026-08-19T17:59:16.588Z
---
`tbd integration status` prints a masked credential and its origin as `********abcd from .env`, which does not say which `.env`. Once resolution can reach outside the current directory, that ambiguity hides where a credential came from and makes a layer-2 override undiscoverable.

Carry the absolute path on `ResolvedCredential` and print it. `describeSource` in `integrations/core/status.ts` currently maps the `dotenv` source to the bare constant `ENV_FILE_NAME`, so the path has to travel from `resolveCredential` rather than being reconstructed at the render site. Keep the masking unchanged: never print the key itself.

Point the `.env` safety finding at the same file. `envFileFinding` reports whether a `.env` exists and whether git ignores it, and today it asks only about the current working tree. When the credential came from the main worktree, that is the file whose ignore status matters. Reporting on one file while reading another is how a committed key stays invisible, which is the highest-cost failure this check exists to prevent.
